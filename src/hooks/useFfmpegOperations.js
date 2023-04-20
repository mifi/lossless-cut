import { useCallback } from 'react';
import flatMap from 'lodash/flatMap';
import sum from 'lodash/sum';
import pMap from 'p-map';

import { getSuffixedOutPath, transferTimestamps, getOutFileExtension, getOutDir, deleteDispositionValue, getHtml5ifiedPath } from '../util';
import { isCuttingStart, isCuttingEnd, handleProgress, getFfCommandLine, getDuration, runFfmpeg, createChaptersFromSegments, readFileMeta, cutEncodeSmartPart, getExperimentalArgs, html5ify as ffmpegHtml5ify, getVideoTimescaleArgs, RefuseOverwriteError, logStdoutStderr } from '../ffmpeg';
import { getMapStreamsArgs, getStreamIdsToCopy } from '../util/streams';
import { getSmartCutParams } from '../smartcut';

const { join, resolve, dirname } = window.require('path');
const { pathExists } = window.require('fs-extra');
const { writeFile, unlink, mkdir } = window.require('fs/promises');
const stringToStream = window.require('string-to-stream');

async function writeChaptersFfmetadata(outDir, chapters) {
  if (!chapters || chapters.length === 0) return undefined;

  const path = join(outDir, `ffmetadata-${new Date().getTime()}.txt`);

  const ffmetadata = chapters.map(({ start, end, name }) => (
    `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.floor(start * 1000)}\nEND=${Math.floor(end * 1000)}\ntitle=${name || ''}`
  )).join('\n\n');
  console.log('Writing chapters', ffmetadata);
  await writeFile(path, ffmetadata);
  return path;
}

function getMovFlags({ preserveMovData, movFastStart }) {
  const flags = [];

  // https://video.stackexchange.com/a/26084/29486
  // https://github.com/mifi/lossless-cut/issues/331#issuecomment-623401794
  if (preserveMovData) flags.push('use_metadata_tags');

  // https://github.com/mifi/lossless-cut/issues/347
  if (movFastStart) flags.push('+faststart');

  if (flags.length === 0) return [];
  return flatMap(flags, flag => ['-movflags', flag]);
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

const getChaptersInputArgs = (ffmetadataPath) => (ffmetadataPath ? ['-f', 'ffmetadata', '-i', ffmetadataPath] : []);

const tryDeleteFiles = async (paths) => pMap(paths, (path) => {
  unlink(path).catch((err) => console.error('Failed to delete', path, err));
}, { concurrency: 5 });

function useFfmpegOperations({ filePath, enableTransferTimestamps, needSmartCut }) {
  const optionalTransferTimestamps = useCallback(async (...args) => {
    if (enableTransferTimestamps) await transferTimestamps(...args);
  }, [enableTransferTimestamps]);

  const concatFiles = useCallback(async ({ paths, outDir, outPath, metadataFromPath, includeAllStreams, streams, outFormat, ffmpegExperimental, onProgress = () => {}, preserveMovData, movFastStart, chapters, preserveMetadataOnMerge, videoTimebase, appendFfmpegCommandLog }) => {
    console.log('Merging files', { paths }, 'to', outPath);

    const durations = await pMap(paths, getDuration, { concurrency: 1 });
    const totalDuration = sum(durations);

    let chaptersPath;
    if (chapters) {
      const chaptersWithNames = chapters.map((chapter, i) => ({ ...chapter, name: chapter.name || `Chapter ${i + 1}` }));
      chaptersPath = await writeChaptersFfmetadata(outDir, chaptersWithNames);
    }

    try {
      let inputArgs = [];
      let inputIndex = 0;

      // Keep track of input index to be used later
      // eslint-disable-next-line no-inner-declarations
      function addInput(args) {
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

      let metadataSourceIndex;
      if (preserveMetadataOnMerge) {
        // If preserve metadata, add the first file (we will get metadata from this input)
        metadataSourceIndex = addInput(['-i', metadataFromPath]);
      }

      let chaptersInputIndex;
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

      // Keep this similar to cutSingle()
      const ffmpegArgs = [
        '-hide_banner',
        // No progress if we set loglevel warning :(
        // '-loglevel', 'warning',

        ...inputArgs,

        ...mapStreamsArgs,

        // -map_metadata 0 with concat demuxer doesn't transfer metadata from the concat'ed file input (index 0) when merging.
        // So we use the first file file (index 1) for metadata
        // Can only do this if allStreams (-map 0) is set
        ...(metadataSourceIndex != null ? ['-map_metadata', metadataSourceIndex] : []),

        ...(chaptersInputIndex != null ? ['-map_chapters', chaptersInputIndex] : []),

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
      const concatTxt = paths.map(file => `file 'file:${resolve(file).replace(/'/g, "'\\''")}'`).join('\n');

      const ffmpegCommandLine = getFfCommandLine('ffmpeg', ffmpegArgs);

      const fullCommandLine = `echo -e "${concatTxt.replace(/\n/, '\\n')}" | ${ffmpegCommandLine}`;
      console.log(fullCommandLine);
      appendFfmpegCommandLog(fullCommandLine);

      const process = runFfmpeg(ffmpegArgs);

      handleProgress(process, totalDuration, onProgress);

      stringToStream(concatTxt).pipe(process.stdin);

      const result = await process;
      logStdoutStderr(result);

      await optionalTransferTimestamps(metadataFromPath, outPath);

      return { haveExcludedStreams: excludedStreamIds.length > 0 };
    } finally {
      if (chaptersPath) await tryDeleteFiles([chaptersPath]);
    }
  }, [optionalTransferTimestamps]);

  const cutSingle = useCallback(async ({
    keyframeCut: ssBeforeInput, avoidNegativeTs, copyFileStreams, cutFrom, cutTo, chaptersPath, onProgress, outPath,
    videoDuration, rotation, allFilesMeta, outFormat, appendFfmpegCommandLog, shortestFlag, ffmpegExperimental, preserveMovData, movFastStart, customTagsByFile, customTagsByStreamId, dispositionByStreamId, videoTimebase,
  }) => {
    const cuttingStart = isCuttingStart(cutFrom);
    const cuttingEnd = isCuttingEnd(cutTo, videoDuration);
    console.log('Cutting from', cuttingStart ? cutFrom : 'start', 'to', cuttingEnd ? cutTo : 'end');

    const cutDuration = cutTo - cutFrom;

    // Don't cut if no need: https://github.com/mifi/lossless-cut/issues/50
    const cutFromArgs = cuttingStart ? ['-ss', cutFrom.toFixed(5)] : [];
    const cutToArgs = cuttingEnd ? ['-t', cutDuration.toFixed(5)] : [];

    const copyFileStreamsFiltered = copyFileStreams.filter(({ streamIds }) => streamIds.length > 0);

    // remove -avoid_negative_ts make_zero when not cutting start (no -ss), or else some videos get blank first frame in QuickLook
    const avoidNegativeTsArgs = cuttingStart && avoidNegativeTs ? ['-avoid_negative_ts', avoidNegativeTs] : [];

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
    function mapInputStreamIndexToOutputIndex(inputFilePath, inputFileStreamIndex) {
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

    function lessDeepMap(root, fn) {
      let ret = [];
      Object.entries(root).forEach(([path, streamsMap]) => (
        Object.entries(streamsMap || {}).forEach(([streamId, value]) => {
          ret = [...ret, ...fn(path, streamId, value)];
        })));

      return ret;
    }

    // The structure is deep! file -> stream -> key -> value Example: { 'file.mp4': { 0: { key: 'value' } } }
    const deepMap = (root, fn) => lessDeepMap(root, (path, streamId, tagsMap) => {
      let ret = [];
      Object.entries(tagsMap || {}).forEach(([key, value]) => {
        ret = [...ret, ...fn(path, streamId, key, value)];
      });
      return ret;
    });

    const customTagsArgs = [
      // Main file metadata:
      ...flatMap(Object.entries(customTagsByFile[filePath] || []), ([key, value]) => ['-metadata', `${key}=${value}`]),

      // Example: { 'file.mp4': { 0: { tag_name: 'Tag Value' } } }
      ...deepMap(customTagsByStreamId, (path, streamId, tag, value) => {
        const outputIndex = mapInputStreamIndexToOutputIndex(path, parseInt(streamId, 10));
        if (outputIndex == null) return [];
        return [`-metadata:s:${outputIndex}`, `${tag}=${value}`];
      }),
    ];

    const mapStreamsArgs = getMapStreamsArgs({ copyFileStreams: copyFileStreamsFiltered, allFilesMeta, outFormat });

    // Example: { 'file.mp4': { 0: { attached_pic: 1 } } }
    const customDispositionArgs = lessDeepMap(dispositionByStreamId, (path, streamId, disposition) => {
      if (disposition == null) return [];
      const outputIndex = mapInputStreamIndexToOutputIndex(path, parseInt(streamId, 10));
      if (outputIndex == null) return [];
      // 0 means delete the disposition for this stream
      const dispositionArg = disposition === deleteDispositionValue ? '0' : disposition;
      return [`-disposition:${outputIndex}`, String(dispositionArg)];
    });

    const ffmpegArgs = [
      '-hide_banner',
      // No progress if we set loglevel warning :(
      // '-loglevel', 'warning',

      ...inputArgs,

      ...mapStreamsArgs,

      '-map_metadata', '0',

      ...(chaptersPath ? ['-map_chapters', chaptersInputIndex] : []),

      ...(shortestFlag ? ['-shortest'] : []),

      ...getMovFlags({ preserveMovData, movFastStart }),
      ...getMatroskaFlags(),

      ...customTagsArgs,

      ...customDispositionArgs,

      // See https://github.com/mifi/lossless-cut/issues/170
      '-ignore_unknown',

      ...getExperimentalArgs(ffmpegExperimental),

      ...rotationArgs,

      ...getVideoTimescaleArgs(videoTimebase),

      '-f', outFormat, '-y', outPath,
    ];

    const ffmpegCommandLine = getFfCommandLine('ffmpeg', ffmpegArgs);

    // console.log(ffmpegCommandLine);
    appendFfmpegCommandLog(ffmpegCommandLine);

    const process = runFfmpeg(ffmpegArgs);
    handleProgress(process, cutDuration, onProgress);
    const result = await process;
    logStdoutStderr(result);

    await optionalTransferTimestamps(filePath, outPath, cutFrom);
  }, [filePath, optionalTransferTimestamps]);

  const cutMultiple = useCallback(async ({
    outputDir, customOutDir, segments, outSegFileNames, videoDuration, rotation, detectedFps,
    onProgress: onTotalProgress, keyframeCut, copyFileStreams, allFilesMeta, outFormat,
    appendFfmpegCommandLog, shortestFlag, ffmpegExperimental, preserveMovData, movFastStart, avoidNegativeTs,
    customTagsByFile, customTagsByStreamId, dispositionByStreamId, chapters, preserveMetadataOnMerge,
    enableOverwriteOutput,
  }) => {
    console.log('customTagsByFile', customTagsByFile);
    console.log('customTagsByStreamId', customTagsByStreamId);

    const singleProgresses = {};
    function onSingleProgress(id, singleProgress) {
      singleProgresses[id] = singleProgress;
      return onTotalProgress((sum(Object.values(singleProgresses)) / segments.length));
    }

    const chaptersPath = await writeChaptersFfmetadata(outputDir, chapters);

    async function checkOverwrite(path) {
      if (!enableOverwriteOutput && await pathExists(path)) throw new RefuseOverwriteError();
    }


    // This function will either call cutSingle (if no smart cut enabled)
    // or if enabled, will first cut&encode the part before the next keyframe, trying to match the input file's codec params
    // then it will cut the part *from* the keyframe to "end", and concat them together and return the concated file
    // so that for the calling code it looks as if it's just a normal segment
    async function maybeSmartCutSegment({ start: desiredCutFrom, end: cutTo }, i) {
      async function makeSegmentOutPath() {
        const outPath = join(outputDir, outSegFileNames[i]);
        // because outSegFileNames might contain slashes https://github.com/mifi/lossless-cut/issues/1532
        const actualOutputDir = dirname(outPath);
        if (actualOutputDir !== outputDir) await mkdir(actualOutputDir, { recursive: true });
        return outPath;
      }

      if (!needSmartCut) {
        // old fashioned way
        const outPath = await makeSegmentOutPath();
        await checkOverwrite(outPath);
        await cutSingle({
          cutFrom: desiredCutFrom, cutTo, chaptersPath, outPath, copyFileStreams, keyframeCut, avoidNegativeTs, videoDuration, rotation, allFilesMeta, outFormat, appendFfmpegCommandLog, shortestFlag, ffmpegExperimental, preserveMovData, movFastStart, customTagsByFile, customTagsByStreamId, dispositionByStreamId, onProgress: (progress) => onSingleProgress(i, progress),
        });
        return outPath;
      }

      // smart cut only supports cutting main file (no externally added files)
      const { streams } = allFilesMeta[filePath];
      const streamsToCopyFromMainFile = copyFileStreams.find(({ path }) => path === filePath).streamIds
        .map((streamId) => streams.find((stream) => stream.index === streamId));

      const { cutFrom: encodeCutTo, segmentNeedsSmartCut, videoCodec, videoBitrate, videoStreamIndex, videoTimebase } = await getSmartCutParams({ path: filePath, videoDuration, desiredCutFrom, streams: streamsToCopyFromMainFile });

      if (segmentNeedsSmartCut && !detectedFps) throw new Error('Smart cut is not possible when FPS is unknown');

      console.log('Smart cut on video stream', videoStreamIndex);

      const onCutProgress = (progress) => onSingleProgress(i, progress / 2);
      const onConcatProgress = (progress) => onSingleProgress(i, (1 + progress) / 2);

      const copyFileStreamsFiltered = [{
        path: filePath,
        // with smart cut, we only copy/cut *one* video stream, but *all* other streams (main file only)
        streamIds: streamsToCopyFromMainFile.filter((stream) => !(stream.codec_type === 'video' && stream.index !== videoStreamIndex)).map((stream) => stream.index),
      }];

      // eslint-disable-next-line no-shadow
      const cutEncodeSmartPartWrapper = async ({ cutFrom, cutTo, outPath }) => cutEncodeSmartPart({ filePath, cutFrom, cutTo, outPath, outFormat, videoCodec, videoBitrate, videoStreamIndex, videoTimebase, allFilesMeta, copyFileStreams: copyFileStreamsFiltered, ffmpegExperimental });

      // If we are cutting within two keyframes, just encode the whole part and return that
      // See https://github.com/mifi/lossless-cut/pull/1267#issuecomment-1236381740
      if (segmentNeedsSmartCut && encodeCutTo > cutTo) {
        const outPath = await makeSegmentOutPath();
        await checkOverwrite(outPath);
        await cutEncodeSmartPartWrapper({ cutFrom: desiredCutFrom, cutTo, outPath });
        return outPath;
      }

      const ext = getOutFileExtension({ isCustomFormatSelected: true, outFormat, filePath });

      const smartCutMainPartOutPath = segmentNeedsSmartCut
        ? getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `smartcut-segment-copy-${i}${ext}` })
        : await makeSegmentOutPath();

      const smartCutEncodedPartOutPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `smartcut-segment-encode-${i}${ext}` });

      const smartCutSegmentsToConcat = [smartCutEncodedPartOutPath, smartCutMainPartOutPath];

      if (!segmentNeedsSmartCut) await checkOverwrite(smartCutMainPartOutPath);

      // for smart cut we need to use keyframe cut here, and no avoid_negative_ts
      await cutSingle({
        cutFrom: encodeCutTo, cutTo, chaptersPath, outPath: smartCutMainPartOutPath, copyFileStreams: copyFileStreamsFiltered, keyframeCut: true, avoidNegativeTs: false, videoDuration, rotation, allFilesMeta, outFormat, appendFfmpegCommandLog, shortestFlag, ffmpegExperimental, preserveMovData, movFastStart, customTagsByFile, customTagsByStreamId, dispositionByStreamId, videoTimebase, onProgress: onCutProgress,
      });

      // OK, just return the single cut file (we may need smart cut in other segments though)
      if (!segmentNeedsSmartCut) return smartCutMainPartOutPath;

      try {
        const frameDuration = 1 / detectedFps;
        const encodeCutToSafe = Math.max(desiredCutFrom + frameDuration, encodeCutTo - frameDuration); // Subtract one frame so we don't end up with duplicates when concating, and make sure we don't create a 0 length segment

        await cutEncodeSmartPartWrapper({ cutFrom: desiredCutFrom, cutTo: encodeCutToSafe, outPath: smartCutEncodedPartOutPath });

        // need to re-read streams because indexes may have changed. Using main file as source of streams and metadata
        const { streams: streamsAfterCut } = await readFileMeta(smartCutMainPartOutPath);

        const outPath = await makeSegmentOutPath();
        await checkOverwrite(outPath);

        await concatFiles({ paths: smartCutSegmentsToConcat, outDir: outputDir, outPath, metadataFromPath: smartCutMainPartOutPath, outFormat, includeAllStreams: true, streams: streamsAfterCut, ffmpegExperimental, preserveMovData, movFastStart, chapters, preserveMetadataOnMerge, videoTimebase, appendFfmpegCommandLog, onProgress: onConcatProgress });
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
  }, [concatFiles, cutSingle, filePath, needSmartCut]);

  const autoConcatCutSegments = useCallback(async ({ customOutDir, isCustomFormatSelected, outFormat, segmentPaths, ffmpegExperimental, onProgress, preserveMovData, movFastStart, autoDeleteMergedSegments, chapterNames, preserveMetadataOnMerge, appendFfmpegCommandLog }) => {
    const ext = getOutFileExtension({ isCustomFormatSelected, outFormat, filePath });
    const outPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `cut-merged-${new Date().getTime()}${ext}` });
    const outDir = getOutDir(customOutDir, filePath);

    const chapters = await createChaptersFromSegments({ segmentPaths, chapterNames });

    const metadataFromPath = segmentPaths[0];
    // need to re-read streams because may have changed
    const { streams } = await readFileMeta(metadataFromPath);
    await concatFiles({ paths: segmentPaths, outDir, outPath, metadataFromPath, outFormat, includeAllStreams: true, streams, ffmpegExperimental, onProgress, preserveMovData, movFastStart, chapters, preserveMetadataOnMerge, appendFfmpegCommandLog });
    if (autoDeleteMergedSegments) await tryDeleteFiles(segmentPaths);

    return outPath;
  }, [concatFiles, filePath]);

  const html5ify = useCallback(async ({ customOutDir, filePath: filePathArg, speed, hasAudio, hasVideo, onProgress }) => {
    const outPath = getHtml5ifiedPath(customOutDir, filePathArg, speed);
    await ffmpegHtml5ify({ filePath: filePathArg, outPath, speed, hasAudio, hasVideo, onProgress });
    await optionalTransferTimestamps(filePathArg, outPath);
    return outPath;
  }, [optionalTransferTimestamps]);

  // This is just used to load something into the player with correct length,
  // so user can seek and then we render frames using ffmpeg
  const html5ifyDummy = useCallback(async ({ filePath: filePathArg, outPath, onProgress }) => {
    console.log('Making HTML5 friendly dummy', { filePathArg, outPath });

    const duration = await getDuration(filePathArg);

    const ffmpegArgs = [
      '-hide_banner',

      // This is just a fast way of generating an empty dummy file
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t', duration,
      '-acodec', 'flac',
      '-y', outPath,
    ];

    const process = runFfmpeg(ffmpegArgs);
    handleProgress(process, duration, onProgress);

    const result = await process;
    logStdoutStderr(result);

    await optionalTransferTimestamps(filePathArg, outPath);
  }, [optionalTransferTimestamps]);

  // https://stackoverflow.com/questions/34118013/how-to-determine-webm-duration-using-ffprobe
  const fixInvalidDuration = useCallback(async ({ fileFormat, customOutDir, duration, onProgress }) => {
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

    const process = runFfmpeg(ffmpegArgs);
    handleProgress(process, duration, onProgress);

    const result = await process;
    logStdoutStderr(result);

    await optionalTransferTimestamps(filePath, outPath);

    return outPath;
  }, [filePath, optionalTransferTimestamps]);

  return {
    cutMultiple, concatFiles, html5ify, html5ifyDummy, fixInvalidDuration, autoConcatCutSegments,
  };
}

export default useFfmpegOperations;
