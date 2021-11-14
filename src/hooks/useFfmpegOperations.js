import { useCallback } from 'react';
import flatMap from 'lodash/flatMap';
import flatMapDeep from 'lodash/flatMapDeep';
import sum from 'lodash/sum';
import pMap from 'p-map';

import { getOutPath, transferTimestamps, getOutFileExtension, getOutDir, isMac } from '../util';
import { isCuttingStart, isCuttingEnd, handleProgress, getFfCommandLine, getFfmpegPath, getDuration, runFfmpeg, createChaptersFromSegments } from '../ffmpeg';

const execa = window.require('execa');
const { join, resolve } = window.require('path');
const fs = window.require('fs-extra');
const stringToStream = window.require('string-to-stream');

async function writeChaptersFfmetadata(outDir, chapters) {
  if (!chapters) return undefined;

  const path = join(outDir, `ffmetadata-${new Date().getTime()}.txt`);

  const ffmetadata = chapters.map(({ start, end, name }, i) => {
    const nameOut = name || `Chapter ${i + 1}`;
    return `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.floor(start * 1000)}\nEND=${Math.floor(end * 1000)}\ntitle=${nameOut}`;
  }).join('\n\n');
  // console.log(ffmetadata);
  await fs.writeFile(path, ffmetadata);
  return path;
}

function getMovFlags({ preserveMovData, movFastStart }) {
  const flags = [];

  // https://video.stackexchange.com/questions/23741/how-to-prevent-ffmpeg-from-dropping-metadata
  // https://video.stackexchange.com/a/26084/29486
  if (preserveMovData) flags.push('use_metadata_tags');

  // https://github.com/mifi/lossless-cut/issues/347
  if (movFastStart) flags.push('+faststart');

  if (flags.length === 0) return [];
  return flatMap(flags, flag => ['-movflags', flag]);
}

function useFfmpegOperations({ filePath, enableTransferTimestamps }) {
  const optionalTransferTimestamps = useCallback(async (...args) => {
    if (enableTransferTimestamps) await transferTimestamps(...args);
  }, [enableTransferTimestamps]);

  // const cut = useCallback(, [filePath, optionalTransferTimestamps]);

  const cutMultiple = useCallback(async ({
    outputDir, segments, segmentsFileNames, videoDuration, rotation,
    onProgress: onTotalProgress, keyframeCut, copyFileStreams, outFormat,
    appendFfmpegCommandLog, shortestFlag, ffmpegExperimental, preserveMovData, movFastStart, avoidNegativeTs,
    customTagsByFile, customTagsByStreamId, dispositionByStreamId,
  }) => {
    async function cutSingle({ cutFrom, cutTo, onProgress, outPath }) {
      const cuttingStart = isCuttingStart(cutFrom);
      const cuttingEnd = isCuttingEnd(cutTo, videoDuration);
      console.log('Exporting from', cuttingStart ? cutFrom : 'start', 'to', cuttingEnd ? cutTo : 'end');

      const ssBeforeInput = keyframeCut;

      const cutDuration = cutTo - cutFrom;

      // Don't cut if no need: https://github.com/mifi/lossless-cut/issues/50
      const cutFromArgs = cuttingStart ? ['-ss', cutFrom.toFixed(5)] : [];
      const cutToArgs = cuttingEnd ? ['-t', cutDuration.toFixed(5)] : [];

      const copyFileStreamsFiltered = copyFileStreams.filter(({ streamIds }) => streamIds.length > 0);

      // remove -avoid_negative_ts make_zero when not cutting start (no -ss), or else some videos get blank first frame in QuickLook
      const avoidNegativeTsArgs = cuttingStart && avoidNegativeTs ? ['-avoid_negative_ts', avoidNegativeTs] : [];

      const inputArgs = flatMap(copyFileStreamsFiltered, ({ path }) => ['-i', path]);
      const inputCutArgs = ssBeforeInput ? [
        ...cutFromArgs,
        ...inputArgs,
        ...cutToArgs,
        ...avoidNegativeTsArgs,
      ] : [
        ...inputArgs,
        ...cutFromArgs,
        ...cutToArgs,
      ];

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
        const copiedStreamIndex = foundFile.streamIds.indexOf(String(inputFileStreamIndex));
        if (copiedStreamIndex === -1) return undefined; // Could happen if a tag has been edited on a stream, but the stream is disabled
        return streamCount + copiedStreamIndex;
      }

      // The structure is deep! file -> stream -> key -> value Example: { 'file.mp4': { 0: { key: 'value' } } }
      const deepMap = (root, fn) => flatMapDeep(
        Object.entries(root), ([path, streamsMap]) => (
          Object.entries(streamsMap || {}).map(([streamId, tagsMap]) => (
            Object.entries(tagsMap || {}).map(([key, value]) => fn(path, streamId, key, value))))),
      );

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

      // Example: { 'file.mp4': { 0: { attached_pic: 1 } } }
      const customDispositionArgs = deepMap(dispositionByStreamId, (path, streamId, disposition, value) => {
        if (value !== 1) return [];
        const outputIndex = mapInputStreamIndexToOutputIndex(path, parseInt(streamId, 10));
        if (outputIndex == null) return [];
        return [`-disposition:${outputIndex}`, String(disposition)];
      });

      const ffmpegArgs = [
        '-hide_banner',
        // No progress if we set loglevel warning :(
        // '-loglevel', 'warning',

        ...inputCutArgs,

        '-c', 'copy',

        ...(shortestFlag ? ['-shortest'] : []),

        ...flatMapDeep(copyFileStreamsFiltered, ({ streamIds }, fileIndex) => streamIds.map(streamId => ['-map', `${fileIndex}:${streamId}`])),
        '-map_metadata', '0',

        ...getMovFlags({ preserveMovData, movFastStart }),

        ...customTagsArgs,

        ...customDispositionArgs,

        // See https://github.com/mifi/lossless-cut/issues/170
        '-ignore_unknown',

        // https://superuser.com/questions/543589/information-about-ffmpeg-command-line-options
        ...(ffmpegExperimental ? ['-strict', 'experimental'] : []),

        ...rotationArgs,

        '-f', outFormat, '-y', outPath,
      ];

      const ffmpegCommandLine = getFfCommandLine('ffmpeg', ffmpegArgs);

      console.log(ffmpegCommandLine);
      appendFfmpegCommandLog(ffmpegCommandLine);

      const ffmpegPath = getFfmpegPath();
      const process = execa(ffmpegPath, ffmpegArgs);
      handleProgress(process, cutDuration, onProgress);
      const result = await process;
      console.log(result.stdout);

      await optionalTransferTimestamps(filePath, outPath, cutFrom);
    }

    console.log('customTagsByFile', customTagsByFile);
    console.log('customTagsByStreamId', customTagsByStreamId);

    const singleProgresses = {};
    function onSingleProgress(id, singleProgress) {
      singleProgresses[id] = singleProgress;
      return onTotalProgress((sum(Object.values(singleProgresses)) / segments.length));
    }

    const outFiles = [];

    // eslint-disable-next-line no-restricted-syntax,no-unused-vars
    for (const [i, { start: cutFrom, end: cutTo }] of segments.entries()) {
      const fileName = segmentsFileNames[i];

      const outPath = join(outputDir, fileName);

      // eslint-disable-next-line no-await-in-loop
      await cutSingle({ cutFrom, cutTo, outPath, onProgress: progress => onSingleProgress(i, progress) });

      outFiles.push(outPath);
    }

    return outFiles;
  }, [filePath, optionalTransferTimestamps]);

  const mergeFiles = useCallback(async ({ paths, outDir, outPath, allStreams, outFormat, ffmpegExperimental, onProgress = () => {}, preserveMovData, movFastStart, chapters, preserveMetadataOnMerge }) => {
    console.log('Merging files', { paths }, 'to', outPath);

    const durations = await pMap(paths, getDuration, { concurrency: 1 });
    const totalDuration = sum(durations);

    const ffmetadataPath = await writeChaptersFfmetadata(outDir, chapters);

    try {
      // Keep this similar to cutSingle()
      const ffmpegArgs = [
        '-hide_banner',
        // No progress if we set loglevel warning :(
        // '-loglevel', 'warning',

        // https://blog.yo1.dog/fix-for-ffmpeg-protocol-not-on-whitelist-error-for-urls/
        '-f', 'concat', '-safe', '0', '-protocol_whitelist', 'file,pipe', '-i', '-',

        // Add the first file for using its metadata. Can only do this if allStreams (-map 0) is set, or else ffmpeg might output this input instead of the concat
        ...(preserveMetadataOnMerge && allStreams ? ['-i', paths[0]] : []),

        // Chapters?
        ...(ffmetadataPath ? ['-f', 'ffmetadata', '-i', ffmetadataPath] : []),

        '-c', 'copy',

        ...(allStreams ? ['-map', '0'] : []),

        // Use the file index 1 for metadata
        // -map_metadata 0 with concat demuxer doesn't seem to preserve metadata when merging.
        // Can only do this if allStreams (-map 0) is set
        ...(preserveMetadataOnMerge && allStreams ? ['-map_metadata', '1'] : []),

        ...getMovFlags({ preserveMovData, movFastStart }),

        // See https://github.com/mifi/lossless-cut/issues/170
        '-ignore_unknown',

        // https://superuser.com/questions/543589/information-about-ffmpeg-command-line-options
        ...(ffmpegExperimental ? ['-strict', 'experimental'] : []),

        ...(outFormat ? ['-f', outFormat] : []),
        '-y', outPath,
      ];

      console.log('ffmpeg', ffmpegArgs.join(' '));

      // https://superuser.com/questions/787064/filename-quoting-in-ffmpeg-concat
      // Must add "file:" or we get "Impossible to open 'pipe:xyz.mp4'" on newer ffmpeg versions
      // https://superuser.com/questions/718027/ffmpeg-concat-doesnt-work-with-absolute-path
      const concatTxt = paths.map(file => `file 'file:${resolve(file).replace(/'/g, "'\\''")}'`).join('\n');

      console.log(concatTxt);

      const ffmpegPath = getFfmpegPath();
      const process = execa(ffmpegPath, ffmpegArgs);

      handleProgress(process, totalDuration, onProgress);

      stringToStream(concatTxt).pipe(process.stdin);

      const { stdout } = await process;
      console.log(stdout);
    } finally {
      if (ffmetadataPath) await fs.unlink(ffmetadataPath).catch((err) => console.error('Failed to delete', ffmetadataPath, err));
    }

    await optionalTransferTimestamps(paths[0], outPath);
  }, [optionalTransferTimestamps]);

  const autoMergeSegments = useCallback(async ({ customOutDir, isCustomFormatSelected, outFormat, segmentPaths, ffmpegExperimental, onProgress, preserveMovData, movFastStart, autoDeleteMergedSegments, chapterNames, preserveMetadataOnMerge }) => {
    const ext = getOutFileExtension({ isCustomFormatSelected, outFormat, filePath });
    const fileName = `cut-merged-${new Date().getTime()}${ext}`;
    const outPath = getOutPath(customOutDir, filePath, fileName);
    const outDir = getOutDir(customOutDir, filePath);

    const chapters = await createChaptersFromSegments({ segmentPaths, chapterNames });

    await mergeFiles({ paths: segmentPaths, outDir, outPath, outFormat, allStreams: true, ffmpegExperimental, onProgress, preserveMovData, movFastStart, chapters, preserveMetadataOnMerge });
    if (autoDeleteMergedSegments) await pMap(segmentPaths, path => fs.unlink(path), { concurrency: 5 });
  }, [filePath, mergeFiles]);

  const html5ify = useCallback(async ({ filePath: specificFilePath, outPath, video, audio, onProgress }) => {
    console.log('Making HTML5 friendly version', { specificFilePath, outPath, video, audio });

    let videoArgs;
    let audioArgs;

    // h264/aac_at: No licensing when using HW encoder (Video/Audio Toolbox on Mac)
    // https://github.com/mifi/lossless-cut/issues/372#issuecomment-810766512

    const targetHeight = 400;

    switch (video) {
      case 'hq': {
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
        if (isMac) {
          audioArgs = ['-acodec', 'aac_at', '-b:a', '192k'];
        } else {
          audioArgs = ['-acodec', 'flac'];
        }
        break;
      }
      case 'lq': {
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

      '-i', specificFilePath,
      ...videoArgs,
      ...audioArgs,
      '-sn',
      '-y', outPath,
    ];

    const duration = await getDuration(specificFilePath);
    const process = runFfmpeg(ffmpegArgs);
    if (duration) handleProgress(process, duration, onProgress);

    const { stdout } = await process;
    console.log(stdout);

    await optionalTransferTimestamps(specificFilePath, outPath);
  }, [optionalTransferTimestamps]);

  // This is just used to load something into the player with correct length,
  // so user can seek and then we render frames using ffmpeg
  const html5ifyDummy = useCallback(async ({ filePath: specificFilePath, outPath, onProgress }) => {
    console.log('Making HTML5 friendly dummy', { specificFilePath, outPath });

    const duration = await getDuration(specificFilePath);

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

    const { stdout } = await process;
    console.log(stdout);

    await optionalTransferTimestamps(specificFilePath, outPath);
  }, [optionalTransferTimestamps]);

  // https://stackoverflow.com/questions/34118013/how-to-determine-webm-duration-using-ffprobe
  const fixInvalidDuration = useCallback(async ({ fileFormat, customOutDir }) => {
    const ext = getOutFileExtension({ outFormat: fileFormat, filePath });
    const fileName = `reformatted${ext}`;
    const outPath = getOutPath(customOutDir, filePath, fileName);

    const ffmpegArgs = [
      '-hide_banner',

      '-i', filePath,

      '-c', 'copy',
      '-y', outPath,
    ];

    // TODO progress
    const { stdout } = await runFfmpeg(ffmpegArgs);
    console.log(stdout);

    await optionalTransferTimestamps(filePath, outPath);

    return outPath;
  }, [filePath, optionalTransferTimestamps]);

  return {
    cutMultiple, mergeFiles, html5ify, html5ifyDummy, fixInvalidDuration, autoMergeSegments,
  };
}

export default useFfmpegOperations;
