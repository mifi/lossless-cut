import pMap from 'p-map';
import flatMap from 'lodash/flatMap';
import flatMapDeep from 'lodash/flatMapDeep';
import sum from 'lodash/sum';
import sortBy from 'lodash/sortBy';
import moment from 'moment';
import i18n from 'i18next';

import { formatDuration, getOutPath, transferTimestamps, filenamify } from './util';

const execa = window.require('execa');
const { join, extname } = window.require('path');
const fileType = window.require('file-type');
const readChunk = window.require('read-chunk');
const readline = window.require('readline');
const stringToStream = window.require('string-to-stream');
const isDev = window.require('electron-is-dev');
const os = window.require('os');
const fs = window.require('fs-extra');


function getFfCommandLine(cmd, args) {
  const mapArg = arg => (/[^0-9a-zA-Z-_]/.test(arg) ? `'${arg}'` : arg);
  return `${cmd} ${args.map(mapArg).join(' ')}`;
}

function getFfmpegPath() {
  const platform = os.platform();

  if (platform === 'darwin') {
    return isDev ? 'ffmpeg-mac/ffmpeg' : join(window.process.resourcesPath, 'ffmpeg');
  }

  const exeName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  return isDev
    ? `node_modules/ffmpeg-static/${exeName}`
    : join(window.process.resourcesPath, `node_modules/ffmpeg-static/${exeName}`);
}

function getFfprobePath() {
  const platform = os.platform();

  if (platform === 'darwin') {
    return isDev ? 'ffmpeg-mac/ffprobe' : join(window.process.resourcesPath, 'ffprobe');
  }

  const map = {
    win32: 'win32/x64/ffprobe.exe',
    linux: 'linux/x64/ffprobe',
  };

  const subPath = map[platform];

  if (!subPath) throw new Error(`${i18n.t('Unsupported platform')} ${platform}`);

  return isDev
    ? `node_modules/ffprobe-static/bin/${subPath}`
    : join(window.process.resourcesPath, `node_modules/ffprobe-static/bin/${subPath}`);
}

async function runFfprobe(args) {
  const ffprobePath = getFfprobePath();
  console.log(getFfCommandLine('ffprobe', args));
  return execa(ffprobePath, args);
}

function runFfmpeg(args) {
  const ffmpegPath = getFfmpegPath();
  console.log(getFfCommandLine('ffmpeg', args));
  return execa(ffmpegPath, args);
}


function handleProgress(process, cutDuration, onProgress) {
  onProgress(0);

  const rl = readline.createInterface({ input: process.stderr });
  rl.on('line', (line) => {
    // console.log('progress', line);

    try {
      let match = line.match(/frame=\s*[^\s]+\s+fps=\s*[^\s]+\s+q=\s*[^\s]+\s+(?:size|Lsize)=\s*[^\s]+\s+time=\s*([^\s]+)\s+/);
      // Audio only looks like this: "line size=  233422kB time=01:45:50.68 bitrate= 301.1kbits/s speed= 353x    "
      if (!match) match = line.match(/(?:size|Lsize)=\s*[^\s]+\s+time=\s*([^\s]+)\s+/);
      if (!match) return;

      const str = match[1];
      // console.log(str);
      const progressTime = Math.max(0, moment.duration(str).asSeconds());
      // console.log(progressTime);
      const progress = cutDuration ? progressTime / cutDuration : 0;
      onProgress(progress);
    } catch (err) {
      console.log('Failed to parse ffmpeg progress line', err);
    }
  });
}

export function isCuttingStart(cutFrom) {
  return cutFrom > 0;
}

export function isCuttingEnd(cutTo, duration) {
  return cutTo < duration;
}

function getExtensionForFormat(format) {
  const ext = {
    matroska: 'mkv',
    ipod: 'm4a',
  }[format];

  return ext || format;
}

function getIntervalAroundTime(time, window) {
  return {
    from: Math.max(time - window / 2, 0),
    to: time + window / 2,
  };
}

export async function readFrames({ filePath, aroundTime, window, stream }) {
  let intervalsArgs = [];
  if (aroundTime != null) {
    const { from, to } = getIntervalAroundTime(aroundTime, window);
    intervalsArgs = ['-read_intervals', `${from}%${to}`];
  }
  const { stdout } = await runFfprobe(['-v', 'error', ...intervalsArgs, '-show_packets', '-select_streams', stream, '-show_entries', 'packet=pts_time,flags', '-of', 'json', filePath]);
  const packetsFiltered = JSON.parse(stdout).packets
    .map(p => ({ keyframe: p.flags[0] === 'K', time: parseFloat(p.pts_time, 10) }))
    .filter(p => !Number.isNaN(p.time));

  return sortBy(packetsFiltered, 'time');
}

// https://stackoverflow.com/questions/14005110/how-to-split-a-video-using-ffmpeg-so-that-each-chunk-starts-with-a-key-frame
// http://kicherer.org/joomla/index.php/de/blog/42-avcut-frame-accurate-video-cutting-with-only-small-quality-loss
export function getSafeCutTime(frames, cutTime, nextMode) {
  const sigma = 0.01;
  const isCloseTo = (time1, time2) => Math.abs(time1 - time2) < sigma;

  let index;

  if (frames.length < 2) throw new Error(i18n.t('Less than 2 frames found'));

  if (nextMode) {
    index = frames.findIndex(f => f.keyframe && f.time >= cutTime - sigma);
    if (index === -1) throw new Error(i18n.t('Failed to find next keyframe'));
    if (index >= frames.length - 1) throw new Error(i18n.t('We are on the last frame'));
    const { time } = frames[index];
    if (isCloseTo(time, cutTime)) {
      return undefined; // Already on keyframe, no need to modify cut time
    }
    return time;
  }

  const findReverseIndex = (arr, cb) => {
    const ret = [...arr].reverse().findIndex(cb);
    if (ret === -1) return -1;
    return arr.length - 1 - ret;
  };

  index = findReverseIndex(frames, f => f.time <= cutTime + sigma);
  if (index === -1) throw new Error(i18n.t('Failed to find any prev frame'));
  if (index === 0) throw new Error(i18n.t('We are on the first frame'));

  if (index === frames.length - 1) {
    // Last frame of video, no need to modify cut time
    return undefined;
  }
  if (frames[index + 1].keyframe) {
    // Already on frame before keyframe, no need to modify cut time
    return undefined;
  }

  // We are not on a frame before keyframe, look for preceding keyframe instead
  index = findReverseIndex(frames, f => f.keyframe && f.time <= cutTime + sigma);
  if (index === -1) throw new Error(i18n.t('Failed to find any prev keyframe'));
  if (index === 0) throw new Error(i18n.t('We are on the first keyframe'));

  // Use frame before the found keyframe
  return frames[index - 1].time;
}

export function findNearestKeyFrameTime({ frames, time, direction, fps }) {
  const sigma = fps ? (1 / fps) : 0.1;
  const keyframes = frames.filter(f => f.keyframe && (direction > 0 ? f.time > time + sigma : f.time < time - sigma));
  if (keyframes.length === 0) return undefined;
  const nearestFrame = sortBy(keyframes, keyframe => (direction > 0 ? keyframe.time - time : time - keyframe.time))[0];
  if (!nearestFrame) return undefined;
  return nearestFrame.time;
}

function getMovFlags(outFormat) {
  let flags = [];

  // https://github.com/mifi/lossless-cut/issues/331
  if (outFormat && ['ipod'].includes(outFormat)) {
    flags = ['+faststart'];
  } else {
    flags = ['use_metadata_tags'];
  }

  return flatMap(flags, flag => ['-movflags', flag]);
}

async function cut({
  filePath, outFormat, cutFrom, cutTo, videoDuration, rotation, ffmpegExperimental,
  onProgress, copyFileStreams, keyframeCut, outPath, appendFfmpegCommandLog, shortestFlag,
}) {
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
  const avoidNegativeTsArgs = cuttingStart ? ['-avoid_negative_ts', 'make_zero'] : [];

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

  const ffmpegArgs = [
    '-hide_banner',
    // No progress if we set loglevel warning :(
    // '-loglevel', 'warning',

    ...inputCutArgs,

    '-c', 'copy',

    ...(shortestFlag ? ['-shortest'] : []),

    ...flatMapDeep(copyFileStreamsFiltered, ({ streamIds }, fileIndex) => streamIds.map(streamId => ['-map', `${fileIndex}:${streamId}`])),
    '-map_metadata', '0',
    // https://video.stackexchange.com/questions/23741/how-to-prevent-ffmpeg-from-dropping-metadata
    ...getMovFlags(outFormat),

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

  await transferTimestamps(filePath, outPath);
}

function getOutFileExtension({ isCustomFormatSelected, outFormat, filePath }) {
  return isCustomFormatSelected ? `.${getExtensionForFormat(outFormat)}` : extname(filePath);
}

export async function cutMultiple({
  customOutDir, filePath, segments: segmentsUnsorted, videoDuration, rotation,
  onProgress, keyframeCut, copyFileStreams, outFormat, isCustomFormatSelected,
  appendFfmpegCommandLog, shortestFlag, ffmpegExperimental,
}) {
  const segments = sortBy(segmentsUnsorted, 'cutFrom');
  const singleProgresses = {};
  function onSingleProgress(id, singleProgress) {
    singleProgresses[id] = singleProgress;
    return onProgress((sum(Object.values(singleProgresses)) / segments.length));
  }

  const outFiles = [];

  let i = 0;
  // eslint-disable-next-line no-restricted-syntax,no-unused-vars
  for (const { start, end, name } of segments) {
    const cutFromStr = formatDuration({ seconds: start, fileNameFriendly: true });
    const cutToStr = formatDuration({ seconds: end, fileNameFriendly: true });
    const segNamePart = name ? `-${filenamify(name)}` : '';
    const cutSpecification = `${cutFromStr}-${cutToStr}${segNamePart}`.substr(0, 200);
    const ext = getOutFileExtension({ isCustomFormatSelected, outFormat, filePath });
    const fileName = `${cutSpecification}${ext}`;
    const outPath = getOutPath(customOutDir, filePath, fileName);

    // eslint-disable-next-line no-await-in-loop
    await cut({
      outPath,
      customOutDir,
      filePath,
      outFormat,
      videoDuration,
      rotation,
      copyFileStreams,
      keyframeCut,
      cutFrom: start,
      cutTo: end,
      shortestFlag,
      // eslint-disable-next-line no-loop-func
      onProgress: progress => onSingleProgress(i, progress),
      appendFfmpegCommandLog,
      ffmpegExperimental,
    });

    outFiles.push(outPath);

    i += 1;
  }

  return outFiles;
}

export async function tryReadChaptersToEdl(filePath) {
  try {
    const { stdout } = await runFfprobe(['-i', filePath, '-show_chapters', '-print_format', 'json']);
    return JSON.parse(stdout).chapters.map((chapter) => {
      const start = parseInt(chapter.start_time, 10);
      const end = parseInt(chapter.end_time, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) return undefined;

      const name = chapter.tags && typeof chapter.tags.title === 'string' ? chapter.tags.title : undefined;

      return {
        start,
        end,
        name,
      };
    }).filter((it) => it);
  } catch (err) {
    console.error('Failed to read chapters from file', err);
    return [];
  }
}

export async function getFormatData(filePath) {
  console.log('getFormatData', filePath);

  const { stdout } = await runFfprobe([
    '-of', 'json', '-show_format', '-i', filePath,
  ]);
  return JSON.parse(stdout).format;
}


export async function getDuration(filePath) {
  return parseFloat((await getFormatData(filePath)).duration);
}

export async function html5ify({ filePath, outPath, video, audio, onProgress }) {
  console.log('Making HTML5 friendly version', { filePath, outPath, video, audio });

  let videoArgs;
  let audioArgs;

  const isMac = os.platform() === 'darwin';

  switch (video) {
    case 'hq': {
      if (isMac) {
        videoArgs = ['-vf', 'format=yuv420p', '-allow_sw', '1', '-vcodec', 'h264', '-b:v', '15M'];
      } else {
        videoArgs = ['-vf', 'format=yuv420p', '-vcodec', 'libx264', '-profile:v', 'high', '-preset:v', 'slow', '-crf', '17'];
      }
      break;
    }
    case 'lq': {
      if (isMac) {
        videoArgs = ['-vf', 'scale=-2:400,format=yuv420p', '-allow_sw', '1', '-sws_flags', 'lanczos', '-vcodec', 'h264', '-b:v', '1500k'];
      } else {
        videoArgs = ['-vf', 'scale=-2:400,format=yuv420p', '-sws_flags', 'neighbor', '-vcodec', 'libx264', '-profile:v', 'baseline', '-x264opts', 'level=3.0', '-preset:v', 'ultrafast', '-crf', '28'];
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
      audioArgs = ['-acodec', 'aac', '-b:a', '192k'];
      break;
    }
    case 'lq-flac': {
      audioArgs = ['-acodec', 'flac', '-ar', '11025', '-ac', '2'];
      break;
    }
    case 'lq-aac': {
      audioArgs = ['-acodec', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '96k'];
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

    '-i', filePath,
    ...videoArgs,
    ...audioArgs,
    '-y', outPath,
  ];

  const duration = await getDuration(filePath);
  const process = runFfmpeg(ffmpegArgs);
  if (duration) handleProgress(process, duration, onProgress);

  const { stdout } = await process;
  console.log(stdout);

  await transferTimestamps(filePath, outPath);
}

// This is just used to load something into the player with correct length,
// so user can seek and then we render frames using ffmpeg
export async function html5ifyDummy(filePath, outPath, onProgress) {
  console.log('Making HTML5 friendly dummy', { filePath, outPath });

  const duration = await getDuration(filePath);

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

  await transferTimestamps(filePath, outPath);
}

export async function mergeFiles({ paths, outPath, allStreams, outFormat, ffmpegExperimental, onProgress = () => {} }) {
  console.log('Merging files', { paths }, 'to', outPath);

  const durations = await pMap(paths, getDuration, { concurrency: 1 });
  const totalDuration = sum(durations);

  // Keep this similar to cut()
  const ffmpegArgs = [
    '-hide_banner',
    // No progress if we set loglevel warning :(
    // '-loglevel', 'warning',

    // https://blog.yo1.dog/fix-for-ffmpeg-protocol-not-on-whitelist-error-for-urls/
    '-f', 'concat', '-safe', '0', '-protocol_whitelist', 'file,pipe', '-i', '-',

    '-c', 'copy',

    ...(allStreams ? ['-map', '0'] : []),
    '-map_metadata', '0',
    // https://video.stackexchange.com/questions/23741/how-to-prevent-ffmpeg-from-dropping-metadata
    ...getMovFlags(outFormat),

    // See https://github.com/mifi/lossless-cut/issues/170
    '-ignore_unknown',

    // https://superuser.com/questions/543589/information-about-ffmpeg-command-line-options
    ...(ffmpegExperimental ? ['-strict', 'experimental'] : []),

    ...(outFormat ? ['-f', outFormat] : []),
    '-y', outPath,
  ];

  console.log('ffmpeg', ffmpegArgs.join(' '));

  // https://superuser.com/questions/787064/filename-quoting-in-ffmpeg-concat
  const concatTxt = paths.map(file => `file '${join(file).replace(/'/g, "'\\''")}'`).join('\n');

  console.log(concatTxt);

  const ffmpegPath = getFfmpegPath();
  const process = execa(ffmpegPath, ffmpegArgs);

  handleProgress(process, totalDuration, onProgress);

  stringToStream(concatTxt).pipe(process.stdin);

  const { stdout } = await process;
  console.log(stdout);

  await transferTimestamps(paths[0], outPath);
}

export async function autoMergeSegments({ customOutDir, sourceFile, isCustomFormatSelected, outFormat, segmentPaths, ffmpegExperimental, onProgress }) {
  const ext = getOutFileExtension({ isCustomFormatSelected, outFormat, filePath: sourceFile });
  const fileName = `cut-merged-${new Date().getTime()}${ext}`;
  const outPath = getOutPath(customOutDir, sourceFile, fileName);

  await mergeFiles({ paths: segmentPaths, outPath, outFormat, allStreams: true, ffmpegExperimental, onProgress });
  await pMap(segmentPaths, path => fs.unlink(path), { concurrency: 5 });
}

/**
 * ffmpeg only supports encoding certain formats, and some of the detected input
 * formats are not the same as the names used for encoding.
 * Therefore we have to map between detected format and encode format
 * See also ffmpeg -formats
 */
function mapFormat(requestedFormat) {
  switch (requestedFormat) {
    // These two cmds produce identical output, so we assume that encoding "ipod" means encoding m4a
    // ffmpeg -i example.aac -c copy OutputFile2.m4a
    // ffmpeg -i example.aac -c copy -f ipod OutputFile.m4a
    // See also https://github.com/mifi/lossless-cut/issues/28
    case 'm4a': return 'ipod';
    case 'aac': return 'ipod';
    default: return requestedFormat;
  }
}

function determineOutputFormat(ffprobeFormats, ft) {
  if (ffprobeFormats.includes(ft.ext)) return ft.ext;
  return ffprobeFormats[0] || undefined;
}

export async function getFormatData(filePath) {
  console.log('getFormatData', filePath);

  const { stdout } = await runFfprobe([
    '-of', 'json', '-show_format', '-i', filePath,
  ]);
  return JSON.parse(stdout).format;
}

export async function getDefaultOutFormat(filePath, formatData) {
  const formatsStr = formatData.format_name;
  console.log('formats', formatsStr);
  const formats = (formatsStr || '').split(',');

  // ffprobe sometimes returns a list of formats, try to be a bit smarter about it.
  const bytes = await readChunk(filePath, 0, 4100);
  const ft = fileType(bytes) || {};
  console.log(`fileType detected format ${JSON.stringify(ft)}`);
  const assumedFormat = determineOutputFormat(formats, ft);
  return mapFormat(assumedFormat);
}

export async function getAllStreams(filePath) {
  const { stdout } = await runFfprobe([
    '-of', 'json', '-show_entries', 'stream', '-i', filePath,
  ]);

  return JSON.parse(stdout);
}

function getPreferredCodecFormat(codec, type) {
  const map = {
    mp3: 'mp3',
    opus: 'opus',
    vorbis: 'ogg',
    h264: 'mp4',
    hevc: 'mp4',
    eac3: 'eac3',

    subrip: 'srt',

    // See mapFormat
    m4a: 'ipod',
    aac: 'ipod',

    // TODO add more
    // TODO allow user to change?
  };

  const format = map[codec];
  if (format) return { ext: getExtensionForFormat(format), format };
  if (type === 'video') return { ext: 'mkv', format: 'matroska' };
  if (type === 'audio') return { ext: 'mka', format: 'matroska' };
  if (type === 'subtitle') return { ext: 'mks', format: 'matroska' };
  if (type === 'data') return { ext: 'bin', format: 'data' }; // https://superuser.com/questions/1243257/save-data-stream

  return undefined;
}

// https://stackoverflow.com/questions/32922226/extract-every-audio-and-subtitles-from-a-video-with-ffmpeg
export async function extractStreams({ filePath, customOutDir, streams }) {
  const outStreams = streams.map((s) => ({
    index: s.index,
    codec: s.codec_name || s.codec_tag_string || s.codec_type,
    type: s.codec_type,
    format: getPreferredCodecFormat(s.codec_name, s.codec_type),
  }))
    .filter(it => it && it.format && it.index != null);

  // console.log(outStreams);

  const streamArgs = flatMap(outStreams, ({
    index, codec, type, format: { format, ext },
  }) => [
    '-map', `0:${index}`, '-c', 'copy', '-f', format, '-y', getOutPath(customOutDir, filePath, `stream-${index}-${type}-${codec}.${ext}`),
  ]);

  const ffmpegArgs = [
    '-hide_banner',

    '-i', filePath,
    ...streamArgs,
  ];

  // TODO progress
  const { stdout } = await runFfmpeg(ffmpegArgs);
  console.log(stdout);
}

async function renderThumbnail(filePath, timestamp) {
  const args = [
    '-ss', timestamp,
    '-i', filePath,
    '-vf', 'scale=-2:200',
    '-f', 'image2',
    '-vframes', '1',
    '-q:v', '10',
    '-',
  ];

  const ffmpegPath = await getFfmpegPath();
  const { stdout } = await execa(ffmpegPath, args, { encoding: null });

  const blob = new Blob([stdout], { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}

export async function renderThumbnails({ filePath, from, duration, onThumbnail }) {
  // Time first render to determine how many to render
  const startTime = new Date().getTime() / 1000;
  let url = await renderThumbnail(filePath, from);
  const endTime = new Date().getTime() / 1000;
  onThumbnail({ time: from, url });

  // Aim for max 3 sec to render all
  const numThumbs = Math.floor(Math.min(Math.max(3 / (endTime - startTime), 3), 10));
  // console.log(numThumbs);

  const thumbTimes = Array(numThumbs - 1).fill().map((unused, i) => (from + ((duration * (i + 1)) / (numThumbs))));
  // console.log(thumbTimes);

  await pMap(thumbTimes, async (time) => {
    url = await renderThumbnail(filePath, time);
    onThumbnail({ time, url });
  }, { concurrency: 2 });
}


export async function renderWaveformPng({ filePath, aroundTime, window, color }) {
  const { from, to } = getIntervalAroundTime(aroundTime, window);

  const args1 = [
    '-i', filePath,
    '-ss', from,
    '-t', to - from,
    '-c', 'copy',
    '-vn',
    '-map', 'a:0',
    '-f', 'matroska', // mpegts doesn't support vorbis etc
    '-',
  ];

  const args2 = [
    '-i', '-',
    '-filter_complex', `aformat=channel_layouts=mono,showwavespic=s=640x120:scale=sqrt:colors=${color}`,
    '-frames:v', '1',
    '-vcodec', 'png',
    '-f', 'image2',
    '-',
  ];

  console.log(getFfCommandLine('ffmpeg1', args1));
  console.log(getFfCommandLine('ffmpeg2', args2));

  let ps1;
  let ps2;
  try {
    const ffmpegPath = getFfmpegPath();
    ps1 = execa(ffmpegPath, args1, { encoding: null, buffer: false });
    ps2 = execa(ffmpegPath, args2, { encoding: null });
    ps1.stdout.pipe(ps2.stdin);

    const { stdout } = await ps2;

    const blob = new Blob([stdout], { type: 'image/png' });

    return {
      url: URL.createObjectURL(blob),
      from,
      aroundTime,
      to,
    };
  } catch (err) {
    if (ps1) ps1.kill();
    if (ps2) ps2.kill();
    throw err;
  }
}

export async function extractWaveform({ filePath, outPath }) {
  const numSegs = 10;
  const duration = 60 * 60;
  const maxLen = 0.1;
  const segments = Array(numSegs).fill().map((unused, i) => [i * (duration / numSegs), Math.min(duration / numSegs, maxLen)]);

  // https://superuser.com/questions/681885/how-can-i-remove-multiple-segments-from-a-video-using-ffmpeg
  let filter = segments.map(([from, len], i) => `[0:a]atrim=start=${from}:end=${from + len},asetpts=PTS-STARTPTS[a${i}]`).join(';');
  filter += ';';
  filter += segments.map((arr, i) => `[a${i}]`).join('');
  filter += `concat=n=${segments.length}:v=0:a=1[out]`;

  console.time('ffmpeg');
  await runFfmpeg([
    '-i',
    filePath,
    '-filter_complex',
    filter,
    '-map',
    '[out]',
    '-f', 'wav',
    '-y',
    outPath,
  ]);
  console.timeEnd('ffmpeg');
}

// See also capture-frame.js
export async function captureFrame({ timestamp, videoPath, outPath }) {
  const args = [
    '-ss', timestamp,
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '3',
    '-y', outPath,
  ];

  const ffmpegPath = getFfmpegPath();
  await execa(ffmpegPath, args, { encoding: null });
}

// https://www.ffmpeg.org/doxygen/3.2/libavutil_2utils_8c_source.html#l00079
export const defaultProcessedCodecTypes = [
  'video',
  'audio',
  'subtitle',
  'attachment',
];

export function isStreamThumbnail(stream) {
  return stream && stream.disposition && stream.disposition.attached_pic === 1;
}

export function isAudioSupported(streams) {
  const audioStreams = streams.filter(stream => stream.codec_type === 'audio');
  if (audioStreams.length === 0) return true;
  // TODO this could be improved
  return audioStreams.some(stream => !['ac3'].includes(stream.codec_name));
}

export function isIphoneHevc(format, streams) {
  if (!streams.some((s) => s.codec_name === 'hevc')) return false;
  const makeTag = format.tags && format.tags['com.apple.quicktime.make'];
  const modelTag = format.tags && format.tags['com.apple.quicktime.model'];
  return (makeTag === 'Apple' && modelTag.startsWith('iPhone'));
}

export function getStreamFps(stream) {
  const match = typeof stream.avg_frame_rate === 'string' && stream.avg_frame_rate.match(/^([0-9]+)\/([0-9]+)$/);
  if (stream.codec_type === 'video' && match) {
    const num = parseInt(match[1], 10);
    const den = parseInt(match[2], 10);
    if (den > 0) return num / den;
  }
  return undefined;
}

function createRawFfmpeg({ fps = 25, path, inWidth, inHeight, seekTo, oneFrameOnly, execaOpts, streamIndex }) {
  // const fps = 25; // TODO

  const aspectRatio = inWidth / inHeight;

  let newWidth;
  let newHeight;
  if (inWidth > inHeight) {
    newWidth = 320;
    newHeight = Math.floor(newWidth / aspectRatio);
  } else {
    newHeight = 320;
    newWidth = Math.floor(newHeight * aspectRatio);
  }

  const args = [
    '-hide_banner', '-loglevel', 'panic',

    '-re',

    '-ss', seekTo,

    '-noautorotate',

    '-i', path,

    '-vf', `fps=${fps},scale=${newWidth}:${newHeight}:flags=lanczos`,
    '-map', `0:${streamIndex}`,
    '-vcodec', 'rawvideo',
    '-pix_fmt', 'rgba',

    ...(oneFrameOnly ? ['-frames:v', '1'] : []),

    '-f', 'image2pipe',
    '-',
  ];

  // console.log(args);

  return {
    process: execa(getFfmpegPath(), args, execaOpts),
    width: newWidth,
    height: newHeight,
    channels: 4,
  };
}

export function getOneRawFrame({ path, inWidth, inHeight, seekTo, streamIndex }) {
  const { process, width, height, channels } = createRawFfmpeg({ path, inWidth, inHeight, seekTo, streamIndex, oneFrameOnly: true, execaOpts: { encoding: null } });
  return { process, width, height, channels };
}

export function encodeLiveRawStream({ path, inWidth, inHeight, seekTo, streamIndex }) {
  const { process, width, height, channels } = createRawFfmpeg({ path, inWidth, inHeight, seekTo, streamIndex, execaOpts: { encoding: null, buffer: false } });

  return {
    process,
    width,
    height,
    channels,
  };
}
