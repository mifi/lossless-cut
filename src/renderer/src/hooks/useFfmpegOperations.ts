import { useCallback } from 'react';
import flatMap from 'lodash/flatMap';
import sum from 'lodash/sum';
import pMap from 'p-map';
import invariant from 'tiny-invariant';

import { getSuffixedOutPath, transferTimestamps, getOutFileExtension, getOutDir, deleteDispositionValue, getHtml5ifiedPath, unlinkWithRetry, getFrameDuration, isMac } from '../util';
import { isCuttingStart, isCuttingEnd, runFfmpegWithProgress, getFfCommandLine, getDuration, createChaptersFromSegments, readFileMeta, getExperimentalArgs, getVideoTimescaleArgs, logStdoutStderr, runFfmpegConcat, RefuseOverwriteError, runFfmpeg } from '../ffmpeg';
import { getMapStreamsArgs, getStreamIdsToCopy } from '../util/streams';
import { getSmartCutParams } from '../smartcut';
import { getGuaranteedSegments, isDurationValid } from '../segments';
import { FFprobeStream } from '../../../../ffprobe';
import { AvoidNegativeTs, Html5ifyMode, PreserveMetadata } from '../../../../types';
import { AllFilesMeta, Chapter, CopyfileStreams, CustomTagsByFile, LiteFFprobeStream, ParamsByStreamId, SegmentToExport } from '../types';

const { join, resolve, dirname } = window.require('path');
const { writeFile, mkdir, access, constants: { F_OK, W_OK } } = window.require('fs/promises');


export class OutputNotWritableError extends Error {
  constructor() {
    super();
    this.name = 'OutputNotWritableError';
  }
}

async function writeChaptersFfmetadata(outDir: string, chapters: Chapter[] | undefined) {
  if (!chapters || chapters.length === 0) return undefined;

  const path = join(outDir, `ffmetadata-${Date.now()}.txt`);

  const ffmetadata = chapters.map(({ start, end, name }) => (
    `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.floor(start * 1000)}\nEND=${Math.floor(end * 1000)}\ntitle=${name || ''}`
  )).join('\n\n');
  console.log('Writing chapters', ffmetadata);
  await writeFile(path, ffmetadata);
  return path;
}

function getMovFlags({ preserveMovData, movFastStart }: { preserveMovData: boolean, movFastStart: boolean }) {
  const flags: string[] = [];

  // https://video.stackexchange.com/a/26084/29486
  // https://github.com/mifi/lossless-cut/issues/331#issuecomment-623401794
  if (preserveMovData) flags.push('use_metadata_tags');

  // https://github.com/mifi/lossless-cut/issues/347
  if (movFastStart) flags.push('+faststart');

  if (flags.length === 0) return [];
  return flatMap(flags, (flag) => ['-movflags', flag]);
}

function getMatroskaFlags() {
  return [
    '-default_mode', 'infer_no_subs',
    // because it makes sense to not force subtitles disposition to "default" if they were not default in the input file
    // after some testing, it seems that default is actually "infer", contrary to what is documented (ffmpeg doc says "passthrough" is default)
    // https://ffmpeg.org/ffmpeg-formats.html#Options-8
    // https://github.com/mifi/lossless-cut/issues/972#issuecomment-1015176316
  ];
}

const getChaptersInputArgs = (ffmetadataPath: string | undefined) => (ffmetadataPath ? ['-f', 'ffmetadata', '-i', ffmetadataPath] : []);

async function tryDeleteFiles(paths: string[]) {
  return pMap(paths, (path) => unlinkWithRetry(path).catch((err) => console.error('Failed to delete', path, err)), { concurrency: 5 });
}

async function pathExists(path: string) {
  try {
    await access(path, F_OK);
    return true;
  } catch {
    return false;
  }
}

function useFfmpegOperations({ filePath, treatInputFileModifiedTimeAsStart, treatOutputFileModifiedTimeAsStart, needSmartCut, enableOverwriteOutput, outputPlaybackRate, cutFromAdjustmentFrames, cutToAdjustmentFrames, appendLastCommandsLog, smartCutCustomBitrate, appendFfmpegCommandLog }: {
  filePath: string | undefined,
  treatInputFileModifiedTimeAsStart: boolean | null | undefined,
  treatOutputFileModifiedTimeAsStart: boolean | null | undefined,
  enableOverwriteOutput: boolean,
  needSmartCut: boolean,
  outputPlaybackRate: number,
  cutFromAdjustmentFrames: number,
  cutToAdjustmentFrames: number,
  appendLastCommandsLog: (a: string) => void,
  smartCutCustomBitrate: number | undefined,
  appendFfmpegCommandLog: (args: string[]) => void,
}) {
  const shouldSkipExistingFile = useCallback(async (path: string) => {
    const fileExists = await pathExists(path);

    // If output file exists, check that it is writable, so we can inform user if it's not (or else ffmpeg will fail with "Permission denied")
    // this seems to sometimes happen on Windows, not sure why.
    if (fileExists) {
      try {
        await access(path, W_OK);
      } catch {
        throw new OutputNotWritableError();
      }
    }
    const shouldSkip = !enableOverwriteOutput && fileExists;
    if (shouldSkip) console.log('Not overwriting existing file', path);
    return shouldSkip;
  }, [enableOverwriteOutput]);

  const getOutputPlaybackRateArgs = useCallback(() => (outputPlaybackRate !== 1 ? ['-itsscale', String(1 / outputPlaybackRate)] : []), [outputPlaybackRate]);

  const concatFiles = useCallback(async ({ paths, outDir, outPath, metadataFromPath, includeAllStreams, streams, outFormat, ffmpegExperimental, onProgress = () => undefined, preserveMovData, movFastStart, chapters, preserveMetadataOnMerge, videoTimebase }: {
    paths: string[],
    outDir: string | undefined,
    outPath: string,
    metadataFromPath: string,
    includeAllStreams: boolean,
    streams: FFprobeStream[],
    outFormat?: string | undefined,
    ffmpegExperimental: boolean,
    onProgress?: (a: number) => void,
    preserveMovData: boolean,
    movFastStart: boolean,
    chapters: Chapter[] | undefined,
    preserveMetadataOnMerge: boolean,
    videoTimebase?: number | undefined,
  }) => {
    if (await shouldSkipExistingFile(outPath)) return { haveExcludedStreams: false };

    console.log('Merging files', { paths }, 'to', outPath);

    const durations = await pMap(paths, getDuration, { concurrency: 1 });
    const totalDuration = sum(durations);

    let chaptersPath: string | undefined;
    if (chapters) {
      const chaptersWithNames = chapters.map((chapter, i) => ({ ...chapter, name: chapter.name || `Chapter ${i + 1}` }));
      invariant(outDir != null);
      chaptersPath = await writeChaptersFfmetadata(outDir, chaptersWithNames);
    }

    try {
      let inputArgs: string[] = [];
      let inputIndex = 0;

      // Keep track of input index to be used later
      // eslint-disable-next-line no-inner-declarations
      function addInput(args: string[]) {
        inputArgs = [...inputArgs, ...args];
        const retIndex = inputIndex;
        inputIndex += 1;
        return retIndex;
      }

      // concat list - always first
      addInput([
        // https://blog.yo1.dog/fix-for-ffmpeg-protocol-not-on-whitelist-error-for-urls/
        '-f', 'concat', '-safe', '0', '-protocol_whitelist', 'file,pipe,fd',
        '-i', '-',
      ]);

      let metadataSourceIndex: number | undefined;
      if (preserveMetadataOnMerge) {
        // If preserve metadata, add the first file (we will get metadata from this input)
        metadataSourceIndex = addInput(['-i', metadataFromPath]);
      }

      let chaptersInputIndex: number | undefined;
      if (chaptersPath) {
        // if chapters, add chapters source file
        chaptersInputIndex = addInput(getChaptersInputArgs(chaptersPath));
      }

      const { streamIdsToCopy, excludedStreamIds } = getStreamIdsToCopy({ streams, includeAllStreams });
      const mapStreamsArgs = getMapStreamsArgs({
        allFilesMeta: { [metadataFromPath]: { streams } },
        copyFileStreams: [{ path: metadataFromPath, streamIds: streamIdsToCopy }],
        outFormat,
        manuallyCopyDisposition: true,
      });

      // Keep this similar to losslessCutSingle()
      const ffmpegArgs = [
        '-hide_banner',
        // No progress if we set loglevel warning :(
        // '-loglevel', 'warning',

        ...inputArgs,

        ...mapStreamsArgs,

        // -map_metadata 0 with concat demuxer doesn't transfer metadata from the concat'ed file input (index 0) when merging.
        // So we use the first file file (index 1) for metadata
        // Can only do this if allStreams (-map 0) is set
        ...(metadataSourceIndex != null ? ['-map_metadata', String(metadataSourceIndex)] : []),

        ...(chaptersInputIndex != null ? ['-map_chapters', String(chaptersInputIndex)] : []),

        ...getMovFlags({ preserveMovData, movFastStart }),
        ...getMatroskaFlags(),

        // See https://github.com/mifi/lossless-cut/issues/170
        '-ignore_unknown',

        ...getExperimentalArgs(ffmpegExperimental),

        ...getVideoTimescaleArgs(videoTimebase),

        ...(outFormat ? ['-f', outFormat] : []),
        '-y', outPath,
      ];

      // https://superuser.com/questions/787064/filename-quoting-in-ffmpeg-concat
      // Must add "file:" or we get "Impossible to open 'pipe:xyz.mp4'" on newer ffmpeg versions
      // https://superuser.com/questions/718027/ffmpeg-concat-doesnt-work-with-absolute-path
      const concatTxt = paths.map((file) => `file 'file:${resolve(file).replaceAll('\'', "'\\''")}'`).join('\n');

      const ffmpegCommandLine = getFfCommandLine('ffmpeg', ffmpegArgs);

      const fullCommandLine = `echo -e "${concatTxt.replace(/\n/, '\\n')}" | ${ffmpegCommandLine}`;
      console.log(fullCommandLine);
      appendLastCommandsLog(fullCommandLine);

      const result = await runFfmpegConcat({ ffmpegArgs, concatTxt, totalDuration, onProgress });
      logStdoutStderr(result);

      await transferTimestamps({ inPath: metadataFromPath, outPath, treatOutputFileModifiedTimeAsStart });

      return { haveExcludedStreams: excludedStreamIds.length > 0 };
    } finally {
      if (chaptersPath) await tryDeleteFiles([chaptersPath]);
    }
  }, [appendLastCommandsLog, shouldSkipExistingFile, treatOutputFileModifiedTimeAsStart]);

  const losslessCutSingle = useCallback(async ({
    keyframeCut: ssBeforeInput, avoidNegativeTs, copyFileStreams, cutFrom, cutTo, chaptersPath, onProgress, outPath,
    fileDuration, rotation, allFilesMeta, outFormat, shortestFlag, ffmpegExperimental, preserveMetadata, preserveMovData, preserveChapters, movFastStart, customTagsByFile, paramsByStreamId, videoTimebase, detectedFps,
  }: {
    keyframeCut: boolean,
    avoidNegativeTs: AvoidNegativeTs | undefined,
    copyFileStreams: CopyfileStreams,
    cutFrom: number,
    cutTo: number,
    chaptersPath: string | undefined,
    onProgress: (p: number) => void,
    outPath: string,
    fileDuration: number | undefined,
    rotation: number | undefined,
    allFilesMeta: AllFilesMeta,
    outFormat: string,
    shortestFlag: boolean,
    ffmpegExperimental: boolean,
    preserveMetadata: PreserveMetadata,
    preserveMovData: boolean,
    preserveChapters: boolean,
    movFastStart: boolean,
    customTagsByFile: CustomTagsByFile,
    paramsByStreamId: ParamsByStreamId,
    videoTimebase?: number | undefined,
    detectedFps?: number,
  }) => {
    if (await shouldSkipExistingFile(outPath)) return;

    const frameDuration = getFrameDuration(detectedFps);

    const cuttingStart = isCuttingStart(cutFrom);
    const cutFromWithAdjustment = cutFrom + cutFromAdjustmentFrames * frameDuration;
    const cutToWithAdjustment = cutTo + cutToAdjustmentFrames * frameDuration;
    const cuttingEnd = isCuttingEnd(cutTo, fileDuration);
    const areWeCutting = cuttingStart || cuttingEnd;
    if (areWeCutting) console.log('Cutting from', cuttingStart ? `${cutFrom} (${cutFromWithAdjustment} adjusted ${cutFromAdjustmentFrames} frames)` : 'start', 'to', cuttingEnd ? `${cutTo} (adjusted ${cutToAdjustmentFrames} frames)` : 'end');

    let cutDuration = cutToWithAdjustment - cutFromWithAdjustment;
    if (detectedFps != null) cutDuration = Math.max(cutDuration, frameDuration); // ensure at least one frame duration

    // Don't cut if no need: https://github.com/mifi/lossless-cut/issues/50
    const cutFromArgs = cuttingStart ? ['-ss', cutFromWithAdjustment.toFixed(5)] : [];
    const cutToArgs = cuttingEnd ? ['-t', cutDuration.toFixed(5)] : [];

    const copyFileStreamsFiltered = copyFileStreams.filter(({ streamIds }) => streamIds.length > 0);

    // remove -avoid_negative_ts make_zero when not cutting start (no -ss), or else some videos get blank first frame in QuickLook
    const avoidNegativeTsArgs = cuttingStart && avoidNegativeTs ? ['-avoid_negative_ts', String(avoidNegativeTs)] : [];

    const inputFilesArgs = flatMap(copyFileStreamsFiltered, ({ path }) => ['-i', path]);
    const inputFilesArgsWithCuts = ssBeforeInput ? [
      ...cutFromArgs,
      ...inputFilesArgs,
      ...cutToArgs,
      ...avoidNegativeTsArgs,
    ] : [
      ...inputFilesArgs,
      ...cutFromArgs,
      ...cutToArgs,
    ];

    const inputArgs = [
      ...inputFilesArgsWithCuts,
      ...getChaptersInputArgs(chaptersPath),
    ];

    const chaptersInputIndex = copyFileStreamsFiltered.length;

    const rotationArgs = rotation !== undefined ? ['-metadata:s:v:0', `rotate=${360 - rotation}`] : [];

    // This function tries to calculate the output stream index needed for -metadata:s:x and -disposition:x arguments
    // It is based on the assumption that copyFileStreamsFiltered contains the order of the input files (and their respective streams orders) sent to ffmpeg, to hopefully calculate the same output stream index values that ffmpeg does internally.
    // It also takes into account previously added files that have been removed and disabled streams.
    function mapInputStreamIndexToOutputIndex(inputFilePath: string, inputFileStreamIndex: number) {
      let streamCount = 0;
      // Count copied streams of all files until this input file
      const foundFile = copyFileStreamsFiltered.find(({ path: path2, streamIds }) => {
        if (path2 === inputFilePath) return true;
        streamCount += streamIds.length;
        return false;
      });
      if (!foundFile) return undefined; // Could happen if a tag has been edited on an external file, then the file was removed

      // Then add the index of the current stream index to the count
      const copiedStreamIndex = foundFile.streamIds.indexOf(inputFileStreamIndex);
      if (copiedStreamIndex === -1) return undefined; // Could happen if a tag has been edited on a stream, but the stream is disabled
      return streamCount + copiedStreamIndex;
    }

    invariant(filePath != null);

    const customTagsArgs = [
      // Main file metadata:
      ...flatMap(Object.entries(customTagsByFile[filePath] || []), ([key, value]) => ['-metadata', `${key}=${value}`]),
    ];

    const mapStreamsArgs = getMapStreamsArgs({ copyFileStreams: copyFileStreamsFiltered, allFilesMeta, outFormat, areWeCutting });

    const customParamsArgs = (() => {
      const ret: string[] = [];
      for (const [fileId, fileParams] of paramsByStreamId.entries()) {
        for (const [streamId, streamParams] of fileParams.entries()) {
          const outputIndex = mapInputStreamIndexToOutputIndex(fileId, streamId);
          if (outputIndex != null) {
            const { disposition } = streamParams;
            if (disposition != null) {
              // "0" means delete the disposition for this stream
              const dispositionArg = disposition === deleteDispositionValue ? '0' : disposition;
              ret.push(`-disposition:${outputIndex}`, String(dispositionArg));
            }

            if (streamParams.bsfH264Mp4toannexb) {
              ret.push(`-bsf:${outputIndex}`, String('h264_mp4toannexb'));
            }
            if (streamParams.bsfHevcMp4toannexb) {
              ret.push(`-bsf:${outputIndex}`, String('hevc_mp4toannexb'));
            }

            // custom stream metadata tags
            const { customTags } = streamParams;
            if (customTags != null) {
              for (const [tag, value] of Object.entries(customTags)) {
                ret.push(`-metadata:s:${outputIndex}`, `${tag}=${value}`);
              }
            }
          }
        }
      }
      return ret;
    })();

    function getPreserveMetadata() {
      if (preserveMetadata === 'default') return ['-map_metadata', '0']; // todo isn't this ffmpeg default and can be omitted? https://stackoverflow.com/a/67508734/6519037
      if (preserveMetadata === 'none') return ['-map_metadata', '-1'];
      if (preserveMetadata === 'nonglobal') return ['-map_metadata:g', '-1']; // https://superuser.com/a/1546267/658247
      return [];
    }

    function getPreserveChapters() {
      if (chaptersPath) return ['-map_chapters', String(chaptersInputIndex)];
      if (!preserveChapters) return ['-map_chapters', '-1']; // https://github.com/mifi/lossless-cut/issues/2176
      return []; // default: includes chapters from input
    }

    const ffmpegArgs = [
      '-hide_banner',
      // No progress if we set loglevel warning :(
      // '-loglevel', 'warning',

      ...getOutputPlaybackRateArgs(),

      ...inputArgs,

      ...mapStreamsArgs,

      ...getPreserveMetadata(),

      ...getPreserveChapters(),

      ...(shortestFlag ? ['-shortest'] : []),

      ...getMovFlags({ preserveMovData, movFastStart }),
      ...getMatroskaFlags(),

      ...customTagsArgs,

      ...customParamsArgs,

      // See https://github.com/mifi/lossless-cut/issues/170
      '-ignore_unknown',

      ...getExperimentalArgs(ffmpegExperimental),

      ...rotationArgs,

      ...getVideoTimescaleArgs(videoTimebase),

      '-f', outFormat, '-y', outPath,
    ];

    appendFfmpegCommandLog(ffmpegArgs);
    const result = await runFfmpegWithProgress({ ffmpegArgs, duration: cutDuration, onProgress });
    logStdoutStderr(result);

    await transferTimestamps({ inPath: filePath, outPath, cutFrom, cutTo, treatInputFileModifiedTimeAsStart, duration: isDurationValid(fileDuration) ? fileDuration : undefined, treatOutputFileModifiedTimeAsStart });
  }, [appendFfmpegCommandLog, cutFromAdjustmentFrames, cutToAdjustmentFrames, filePath, getOutputPlaybackRateArgs, shouldSkipExistingFile, treatInputFileModifiedTimeAsStart, treatOutputFileModifiedTimeAsStart]);

  // inspired by https://gist.github.com/fernandoherreradelasheras/5eca67f4200f1a7cc8281747da08496e
  const cutEncodeSmartPart = useCallback(async ({ cutFrom, cutTo, outPath, outFormat, videoCodec, videoBitrate, videoTimebase, allFilesMeta, copyFileStreams, videoStreamIndex, ffmpegExperimental }: {
    cutFrom: number, cutTo: number, outPath: string, outFormat: string, videoCodec: string, videoBitrate: number, videoTimebase: number, allFilesMeta: AllFilesMeta, copyFileStreams: CopyfileStreams, videoStreamIndex: number, ffmpegExperimental: boolean,
  }) => {
    invariant(filePath != null);

    function getVideoArgs({ streamIndex, outputIndex }: { streamIndex: number, outputIndex: number }) {
      if (streamIndex !== videoStreamIndex) return undefined;

      const args = [
        `-c:${outputIndex}`, videoCodec,
        `-b:${outputIndex}`, String(videoBitrate),
      ];

      // seems like ffmpeg handles this itself well when encoding same source file
      // if (videoLevel != null) args.push(`-level:${outputIndex}`, videoLevel);
      // if (videoProfile != null) args.push(`-profile:${outputIndex}`, videoProfile);

      return args;
    }

    const mapStreamsArgs = getMapStreamsArgs({
      allFilesMeta,
      copyFileStreams,
      outFormat,
      getVideoArgs,
    });

    const ffmpegArgs = [
      '-hide_banner',
      // No progress if we set loglevel warning :(
      // '-loglevel', 'warning',

      '-ss', cutFrom.toFixed(5), // if we don't -ss before -i, seeking will be slow for long files, see https://github.com/mifi/lossless-cut/issues/126#issuecomment-1135451043
      '-i', filePath,
      '-ss', '0', // If we don't do this, the output seems to start with an empty black after merging with the encoded part
      '-t', (cutTo - cutFrom).toFixed(5),

      ...mapStreamsArgs,

      // See https://github.com/mifi/lossless-cut/issues/170
      '-ignore_unknown',

      ...getVideoTimescaleArgs(videoTimebase),

      ...getExperimentalArgs(ffmpegExperimental),

      '-f', outFormat, '-y', outPath,
    ];

    appendFfmpegCommandLog(ffmpegArgs);
    await runFfmpeg(ffmpegArgs);
  }, [appendFfmpegCommandLog, filePath]);

  const cutMultiple = useCallback(async ({
    outputDir, customOutDir, segments: segmentsIn, outSegFileNames, fileDuration, rotation, detectedFps, onProgress: onTotalProgress, keyframeCut, copyFileStreams, allFilesMeta, outFormat, shortestFlag, ffmpegExperimental, preserveMetadata, preserveMetadataOnMerge, preserveMovData, preserveChapters, movFastStart, avoidNegativeTs, customTagsByFile, paramsByStreamId, chapters,
  }: {
    outputDir: string,
    customOutDir: string | undefined,
    segments: SegmentToExport[],
    outSegFileNames: string[],
    fileDuration: number | undefined,
    rotation: number | undefined,
    detectedFps: number | undefined,
    onProgress: (p: number) => void,
    keyframeCut: boolean,
    copyFileStreams: CopyfileStreams,
    allFilesMeta: AllFilesMeta,
    outFormat: string | undefined,
    shortestFlag: boolean,
    ffmpegExperimental: boolean,
    preserveMetadata: PreserveMetadata,
    preserveMovData: boolean,
    preserveMetadataOnMerge: boolean,
    preserveChapters: boolean,
    movFastStart: boolean,
    avoidNegativeTs: AvoidNegativeTs | undefined,
    customTagsByFile: CustomTagsByFile,
    paramsByStreamId: ParamsByStreamId,
    chapters: Chapter[] | undefined,
  }) => {
    console.log('customTagsByFile', customTagsByFile);
    console.log('paramsByStreamId', paramsByStreamId);

    const segments = getGuaranteedSegments(segmentsIn, fileDuration);

    const singleProgresses: Record<number, number> = {};
    function onSingleProgress(id: number, singleProgress: number) {
      singleProgresses[id] = singleProgress;
      return onTotalProgress((sum(Object.values(singleProgresses)) / segments.length));
    }

    const chaptersPath = await writeChaptersFfmetadata(outputDir, chapters);

    // This function will either call losslessCutSingle (if no smart cut enabled)
    // or if enabled, will first cut&encode the part before the next keyframe, trying to match the input file's codec params
    // then it will cut the part *from* the keyframe to "end", and concat them together and return the concated file
    // so that for the calling code it looks as if it's just a normal segment
    async function maybeSmartCutSegment({ start: desiredCutFrom, end: cutTo }: { start: number, end: number }, i: number) {
      async function makeSegmentOutPath() {
        const outPath = join(outputDir, outSegFileNames[i]!);
        // because outSegFileNames might contain slashes https://github.com/mifi/lossless-cut/issues/1532
        const actualOutputDir = dirname(outPath);
        if (actualOutputDir !== outputDir) await mkdir(actualOutputDir, { recursive: true });
        return outPath;
      }

      if (!needSmartCut) {
        const outPath = await makeSegmentOutPath();
        invariant(outFormat != null);
        await losslessCutSingle({
          cutFrom: desiredCutFrom, cutTo, chaptersPath, outPath, copyFileStreams, keyframeCut, avoidNegativeTs, fileDuration, rotation, allFilesMeta, outFormat, shortestFlag, ffmpegExperimental, preserveMetadata, preserveMovData, preserveChapters, movFastStart, customTagsByFile, paramsByStreamId, onProgress: (progress) => onSingleProgress(i, progress),
        });
        return outPath;
      }

      invariant(filePath != null);

      // smart cut only supports cutting main file (no externally added files)
      const { streams } = allFilesMeta[filePath]!;
      const streamsToCopyFromMainFile = copyFileStreams.find(({ path }) => path === filePath)!.streamIds
        .flatMap((streamId) => {
          const match = streams.find((stream) => stream.index === streamId);
          return match ? [match] : [];
        });

      const { losslessCutFrom, segmentNeedsSmartCut, videoCodec, videoBitrate: detectedVideoBitrate, videoStreamIndex, videoTimebase } = await getSmartCutParams({ path: filePath, fileDuration, desiredCutFrom, streams: streamsToCopyFromMainFile });

      if (segmentNeedsSmartCut && !detectedFps) throw new Error('Smart cut is not possible when FPS is unknown');

      console.log('Smart cut on video stream', videoStreamIndex);

      const onProgress = (progress: number) => onSingleProgress(i, progress / 2);
      const onConcatProgress = (progress: number) => onSingleProgress(i, (1 + progress) / 2);

      const copyFileStreamsFiltered = [{
        path: filePath,
        // with smart cut, we only copy/cut *one* video stream, and *all* other non-video streams (main file only)
        streamIds: streamsToCopyFromMainFile.filter((stream) => stream.index === videoStreamIndex || stream.codec_type !== 'video').map((stream) => stream.index),
      }];

      // eslint-disable-next-line no-shadow
      async function cutEncodeSmartPartWrapper({ cutFrom, cutTo, outPath }: { cutFrom: number, cutTo: number, outPath: string }) {
        if (await shouldSkipExistingFile(outPath)) return;
        if (videoCodec == null || detectedVideoBitrate == null || videoTimebase == null) throw new Error();
        invariant(filePath != null);
        invariant(outFormat != null);
        await cutEncodeSmartPart({ cutFrom, cutTo, outPath, outFormat, videoCodec, videoBitrate: smartCutCustomBitrate != null ? smartCutCustomBitrate * 1000 : detectedVideoBitrate, videoStreamIndex, videoTimebase, allFilesMeta, copyFileStreams: copyFileStreamsFiltered, ffmpegExperimental });
      }

      // If we are cutting within two keyframes, just encode the whole part and return that
      // See https://github.com/mifi/lossless-cut/pull/1267#issuecomment-1236381740
      if (segmentNeedsSmartCut && losslessCutFrom > cutTo) {
        const outPath = await makeSegmentOutPath();
        console.log('Segment is between two keyframes, cutting/encoding the whole segment', { desiredCutFrom, losslessCutFrom, cutTo });
        await cutEncodeSmartPartWrapper({ cutFrom: desiredCutFrom, cutTo, outPath });
        return outPath;
      }

      invariant(outFormat != null);

      const ext = getOutFileExtension({ isCustomFormatSelected: true, outFormat, filePath });

      const losslessPartOutPath = segmentNeedsSmartCut
        ? getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `smartcut-segment-copy-${i}${ext}` })
        : await makeSegmentOutPath();

      if (segmentNeedsSmartCut) {
        console.log('Cutting/encoding lossless part', { from: losslessCutFrom, to: cutTo });
      }

      // for smart cut we need to use keyframe cut here, and no avoid_negative_ts
      await losslessCutSingle({
        cutFrom: losslessCutFrom, cutTo, chaptersPath, outPath: losslessPartOutPath, copyFileStreams: copyFileStreamsFiltered, keyframeCut: true, avoidNegativeTs: undefined, fileDuration, rotation, allFilesMeta, outFormat, shortestFlag, ffmpegExperimental, preserveMetadata, preserveMovData, preserveChapters, movFastStart, customTagsByFile, paramsByStreamId, videoTimebase, onProgress,
      });

      // OK, just return the single cut file (we may need smart cut in other segments though)
      if (!segmentNeedsSmartCut) return losslessPartOutPath;

      const smartCutEncodedPartOutPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `smartcut-segment-encode-${i}${ext}` });
      const smartCutSegmentsToConcat = [smartCutEncodedPartOutPath, losslessPartOutPath];

      try {
        const frameDuration = getFrameDuration(detectedFps);
        // Subtract one frame so we don't end up with duplicates when concating, and make sure we don't create a 0 length segment
        const encodeCutToSafe = Math.max(desiredCutFrom + frameDuration, losslessCutFrom - frameDuration);

        console.log('Cutting/encoding smart part', { from: desiredCutFrom, to: encodeCutToSafe });

        await cutEncodeSmartPartWrapper({ cutFrom: desiredCutFrom, cutTo: encodeCutToSafe, outPath: smartCutEncodedPartOutPath });

        // need to re-read streams because indexes may have changed. Using main file as source of streams and metadata
        const { streams: streamsAfterCut } = await readFileMeta(losslessPartOutPath);

        const outPath = await makeSegmentOutPath();

        await concatFiles({ paths: smartCutSegmentsToConcat, outDir: outputDir, outPath, metadataFromPath: losslessPartOutPath, outFormat, includeAllStreams: true, streams: streamsAfterCut, ffmpegExperimental, preserveMovData, movFastStart, chapters, preserveMetadataOnMerge, videoTimebase, onProgress: onConcatProgress });
        return outPath;
      } finally {
        await tryDeleteFiles(smartCutSegmentsToConcat);
      }
    }

    try {
      const outFiles = await pMap(segments, maybeSmartCutSegment, { concurrency: 1 });

      return outFiles;
    } finally {
      if (chaptersPath) await tryDeleteFiles([chaptersPath]);
    }
  }, [needSmartCut, filePath, losslessCutSingle, shouldSkipExistingFile, cutEncodeSmartPart, smartCutCustomBitrate, concatFiles]);

  const autoConcatCutSegments = useCallback(async ({ customOutDir, outFormat, segmentPaths, ffmpegExperimental, onProgress, preserveMovData, movFastStart, autoDeleteMergedSegments, chapterNames, preserveMetadataOnMerge, mergedOutFilePath }: {
    customOutDir: string | undefined,
    outFormat: string | undefined,
    segmentPaths: string[],
    ffmpegExperimental: boolean,
    onProgress: (p: number) => void,
    preserveMovData: boolean,
    movFastStart: boolean,
    autoDeleteMergedSegments: boolean,
    chapterNames: (string | undefined)[] | undefined,
    preserveMetadataOnMerge: boolean,
    mergedOutFilePath: string,
  }) => {
    const outDir = getOutDir(customOutDir, filePath);

    if (await shouldSkipExistingFile(mergedOutFilePath)) return;

    const chapters = await createChaptersFromSegments({ segmentPaths, chapterNames });

    const metadataFromPath = segmentPaths[0];
    invariant(metadataFromPath != null);
    // need to re-read streams because may have changed
    const { streams } = await readFileMeta(metadataFromPath);
    await concatFiles({ paths: segmentPaths, outDir, outPath: mergedOutFilePath, metadataFromPath, outFormat, includeAllStreams: true, streams, ffmpegExperimental, onProgress, preserveMovData, movFastStart, chapters, preserveMetadataOnMerge });
    if (autoDeleteMergedSegments) await tryDeleteFiles(segmentPaths);
  }, [concatFiles, filePath, shouldSkipExistingFile]);

  const html5ify = useCallback(async ({ customOutDir, filePath: filePathArg, speed, hasAudio, hasVideo, onProgress }: {
    customOutDir: string | undefined, filePath: string, speed: Html5ifyMode, hasAudio: boolean, hasVideo: boolean, onProgress: (p: number) => void,
  }) => {
    const outPath = getHtml5ifiedPath(customOutDir, filePathArg, speed);
    invariant(outPath != null);

    let audio: string | undefined;
    if (hasAudio) {
      if (speed === 'slowest') audio = 'hq';
      else if (['slow-audio', 'fast-audio'].includes(speed)) audio = 'lq';
      else if (['fast-audio-remux'].includes(speed)) audio = 'copy';
    }

    let video: string | undefined;
    if (hasVideo) {
      if (speed === 'slowest') video = 'hq';
      else if (['slow-audio', 'slow'].includes(speed)) video = 'lq';
      else video = 'copy';
    }

    console.log('Making HTML5 friendly version', { filePathArg, outPath, speed, video, audio });

    let videoArgs: string[];
    let audioArgs: string[];

    // h264/aac_at: No licensing when using HW encoder (Video/Audio Toolbox on Mac)
    // https://github.com/mifi/lossless-cut/issues/372#issuecomment-810766512

    const targetHeight = 400;

    switch (video) {
      case 'hq': {
        // eslint-disable-next-line unicorn/prefer-ternary
        if (isMac) {
          videoArgs = ['-vf', 'format=yuv420p', '-allow_sw', '1', '-vcodec', 'h264', '-b:v', '15M'];
        } else {
          // AV1 is very slow
          // videoArgs = ['-vf', 'format=yuv420p', '-sws_flags', 'neighbor', '-vcodec', 'libaom-av1', '-crf', '30', '-cpu-used', '8'];
          // Theora is a bit faster but not that much
          // videoArgs = ['-vf', '-c:v', 'libtheora', '-qscale:v', '1'];
          // videoArgs = ['-vf', 'format=yuv420p', '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1'];
          // x264 can only be used in GPL projects
          videoArgs = ['-vf', 'format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-preset:v', 'slow', '-crf', '17'];
        }
        break;
      }
      case 'lq': {
        // eslint-disable-next-line unicorn/prefer-ternary
        if (isMac) {
          videoArgs = ['-vf', `scale=-2:${targetHeight},format=yuv420p`, '-allow_sw', '1', '-sws_flags', 'lanczos', '-vcodec', 'h264', '-b:v', '1500k'];
        } else {
          // videoArgs = ['-vf', `scale=-2:${targetHeight},format=yuv420p`, '-sws_flags', 'neighbor', '-c:v', 'libtheora', '-qscale:v', '1'];
          // x264 can only be used in GPL projects
          videoArgs = ['-vf', `scale=-2:${targetHeight},format=yuv420p`, '-sws_flags', 'neighbor', '-c:v', 'libx264', '-profile:v', 'baseline', '-x264opts', 'level=3.0', '-preset:v', 'ultrafast', '-crf', '28'];
        }
        break;
      }
      case 'copy': {
        videoArgs = ['-vcodec', 'copy'];
        break;
      }
      default: {
        videoArgs = ['-vn'];
      }
    }

    switch (audio) {
      case 'hq': {
        // eslint-disable-next-line unicorn/prefer-ternary
        if (isMac) {
          audioArgs = ['-acodec', 'aac_at', '-b:a', '192k'];
        } else {
          audioArgs = ['-acodec', 'flac'];
        }
        break;
      }
      case 'lq': {
        // eslint-disable-next-line unicorn/prefer-ternary
        if (isMac) {
          audioArgs = ['-acodec', 'aac_at', '-ar', '44100', '-ac', '2', '-b:a', '96k'];
        } else {
          audioArgs = ['-acodec', 'flac', '-ar', '11025', '-ac', '2'];
        }
        break;
      }
      case 'copy': {
        audioArgs = ['-acodec', 'copy'];
        break;
      }
      default: {
        audioArgs = ['-an'];
      }
    }

    const ffmpegArgs = [
      '-hide_banner',

      '-i', filePathArg,
      ...videoArgs,
      ...audioArgs,
      '-sn',
      '-y', outPath,
    ];

    const duration = await getDuration(filePathArg);
    appendFfmpegCommandLog(ffmpegArgs);
    const { stdout } = await runFfmpegWithProgress({ ffmpegArgs, duration, onProgress });

    console.log(new TextDecoder().decode(stdout));

    invariant(outPath != null);
    await transferTimestamps({ inPath: filePathArg, outPath, treatOutputFileModifiedTimeAsStart });
    return outPath;
  }, [appendFfmpegCommandLog, treatOutputFileModifiedTimeAsStart]);

  // This is just used to load something into the player with correct duration,
  // so that the user can seek and then we render frames using ffmpeg & MediaSource
  const html5ifyDummy = useCallback(async ({ filePath: filePathArg, outPath, onProgress }: {
    filePath: string,
    outPath: string,
    onProgress: (p: number) => void,
  }) => {
    console.log('Making ffmpeg-assisted dummy file', { filePathArg, outPath });

    const duration = await getDuration(filePathArg);

    const ffmpegArgs = [
      '-hide_banner',

      // This is just a fast way of generating an empty dummy file
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t', String(duration),
      '-acodec', 'flac',
      '-y', outPath,
    ];

    appendFfmpegCommandLog(ffmpegArgs);
    const result = await runFfmpegWithProgress({ ffmpegArgs, duration, onProgress });
    logStdoutStderr(result);

    await transferTimestamps({ inPath: filePathArg, outPath, treatOutputFileModifiedTimeAsStart });
  }, [appendFfmpegCommandLog, treatOutputFileModifiedTimeAsStart]);

  // https://stackoverflow.com/questions/34118013/how-to-determine-webm-duration-using-ffprobe
  const fixInvalidDuration = useCallback(async ({ fileFormat, customOutDir, onProgress }: {
    fileFormat: string,
    customOutDir?: string | undefined,
    onProgress: (a: number) => void,
  }) => {
    invariant(filePath != null);
    const ext = getOutFileExtension({ outFormat: fileFormat, filePath });
    const outPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `reformatted${ext}` });

    const ffmpegArgs = [
      '-hide_banner',

      '-i', filePath,

      // https://github.com/mifi/lossless-cut/issues/1415
      '-map_metadata', '0',
      '-map', '0',
      '-ignore_unknown',

      '-c', 'copy',
      '-y', outPath,
    ];

    appendFfmpegCommandLog(ffmpegArgs);
    const result = await runFfmpegWithProgress({ ffmpegArgs, onProgress });
    logStdoutStderr(result);

    await transferTimestamps({ inPath: filePath, outPath, treatOutputFileModifiedTimeAsStart });

    return outPath;
  }, [appendFfmpegCommandLog, filePath, treatOutputFileModifiedTimeAsStart]);

  function getPreferredCodecFormat(stream: LiteFFprobeStream) {
    const map = {
      mp3: { format: 'mp3', ext: 'mp3' },
      opus: { format: 'opus', ext: 'opus' },
      vorbis: { format: 'ogg', ext: 'ogg' },
      h264: { format: 'mp4', ext: 'mp4' },
      hevc: { format: 'mp4', ext: 'mp4' },
      eac3: { format: 'eac3', ext: 'eac3' },

      subrip: { format: 'srt', ext: 'srt' },
      mov_text: { format: 'mp4', ext: 'mp4' },

      m4a: { format: 'ipod', ext: 'm4a' },
      aac: { format: 'adts', ext: 'aac' },
      jpeg: { format: 'image2', ext: 'jpeg' },
      png: { format: 'image2', ext: 'png' },

      // TODO add more
      // TODO allow user to change?
    } as const;

    const match = map[stream.codec_name as keyof typeof map];
    if (match) return match;

    // default fallbacks:
    if (stream.codec_type === 'video') return { ext: 'mkv', format: 'matroska' } as const;
    if (stream.codec_type === 'audio') return { ext: 'mka', format: 'matroska' } as const;
    if (stream.codec_type === 'subtitle') return { ext: 'mks', format: 'matroska' } as const;
    if (stream.codec_type === 'data') return { ext: 'bin', format: 'data' } as const; // https://superuser.com/questions/1243257/save-data-stream

    return undefined;
  }

  const extractNonAttachmentStreams = useCallback(async ({ customOutDir, streams }: {
    customOutDir?: string | undefined, streams: FFprobeStream[],
  }) => {
    invariant(filePath != null);
    if (streams.length === 0) return [];

    const outStreams = streams.flatMap((s) => {
      const format = getPreferredCodecFormat(s);
      const { index } = s;

      if (format == null || index == null) return [];

      return [{
        index,
        codec: s.codec_name || s.codec_tag_string || s.codec_type,
        type: s.codec_type,
        format,
      }];
    });

    // console.log(outStreams);


    let streamArgs: string[] = [];
    const outPaths = await pMap(outStreams, async ({ index, codec, type, format: { format, ext } }) => {
      const outPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `stream-${index}-${type}-${codec}.${ext}` });
      if (!enableOverwriteOutput && await pathExists(outPath)) throw new RefuseOverwriteError();

      streamArgs = [
        ...streamArgs,
        '-map', `0:${index}`, '-c', 'copy', '-f', format, '-y', outPath,
      ];
      return outPath;
    }, { concurrency: 1 });

    const ffmpegArgs = [
      '-hide_banner',

      '-i', filePath,
      ...streamArgs,
    ];

    appendFfmpegCommandLog(ffmpegArgs);
    const { stdout } = await runFfmpeg(ffmpegArgs);
    console.log(new TextDecoder().decode(stdout));

    return outPaths;
  }, [appendFfmpegCommandLog, enableOverwriteOutput, filePath]);

  const extractAttachmentStreams = useCallback(async ({ customOutDir, streams }: {
    customOutDir?: string | undefined, streams: FFprobeStream[],
  }) => {
    invariant(filePath != null);
    if (streams.length === 0) return [];

    console.log('Extracting', streams.length, 'attachment streams');

    let streamArgs: string[] = [];
    const outPaths = await pMap(streams, async ({ index, codec_name: codec, codec_type: type }) => {
      const ext = codec || 'bin';
      const outPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `stream-${index}-${type}-${codec}.${ext}` });
      if (outPath == null) throw new Error();
      if (!enableOverwriteOutput && await pathExists(outPath)) throw new RefuseOverwriteError();

      streamArgs = [
        ...streamArgs,
        `-dump_attachment:${index}`, outPath,
      ];
      return outPath;
    }, { concurrency: 1 });

    const ffmpegArgs = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      ...streamArgs,
      '-i', filePath,
    ];

    try {
      appendFfmpegCommandLog(ffmpegArgs);
      const { stdout } = await runFfmpeg(ffmpegArgs);
      console.log(new TextDecoder().decode(stdout));
    } catch (err) {
      // Unfortunately ffmpeg will exit with code 1 even though it's a success
      // Note: This is kind of hacky:
      if (err instanceof Error && 'exitCode' in err && 'stderr' in err && err.exitCode === 1 && typeof err.stderr === 'string' && err.stderr.includes('At least one output file must be specified')) return outPaths;
      throw err;
    }
    return outPaths;
  }, [appendFfmpegCommandLog, enableOverwriteOutput, filePath]);

  // https://stackoverflow.com/questions/32922226/extract-every-audio-and-subtitles-from-a-video-with-ffmpeg
  const extractStreams = useCallback(async ({ customOutDir, streams }: {
    customOutDir: string | undefined, streams: FFprobeStream[],
  }) => {
    invariant(filePath != null);

    const attachmentStreams = streams.filter((s) => s.codec_type === 'attachment');
    const nonAttachmentStreams = streams.filter((s) => s.codec_type !== 'attachment');

    // TODO progress

    // Attachment streams are handled differently from normal streams
    return [
      ...(await extractNonAttachmentStreams({ customOutDir, streams: nonAttachmentStreams })),
      ...(await extractAttachmentStreams({ customOutDir, streams: attachmentStreams })),
    ];
  }, [extractAttachmentStreams, extractNonAttachmentStreams, filePath]);

  return {
    cutMultiple, concatFiles, html5ify, html5ifyDummy, fixInvalidDuration, autoConcatCutSegments, extractStreams,
  };
}

export default useFfmpegOperations;
