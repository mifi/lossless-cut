import pMap from 'p-map';
import sortBy from 'lodash/sortBy';
import moment from 'moment';
import i18n from 'i18next';
import Timecode from 'smpte-timecode';
import minBy from 'lodash/minBy';

import { pcmAudioCodecs, getMapStreamsArgs, isMov } from './util/streams';
import { getSuffixedOutPath, isWindows, isMac, platform, arch, isExecaFailure } from './util';
import { isDurationValid } from './segments';

import isDev from './isDev';

const execa = window.require('execa');
const { join } = window.require('path');
const FileType = window.require('file-type');
const readline = window.require('readline');
const { pathExists } = window.require('fs-extra');

let customFfPath;

const runningFfmpegs = new Set();
// setInterval(() => console.log(runningFfmpegs.size), 1000);


export class RefuseOverwriteError extends Error {}

// Note that this does not work on MAS because of sandbox restrictions
export function setCustomFfPath(path) {
  customFfPath = path;
}

export function getFfCommandLine(cmd, args) {
  const mapArg = arg => (/[^0-9a-zA-Z-_]/.test(arg) ? `'${arg}'` : arg);
  return `${cmd} ${args.map(mapArg).join(' ')}`;
}

function getFfPath(cmd) {
  const exeName = isWindows ? `${cmd}.exe` : cmd;

  if (customFfPath) return join(customFfPath, exeName);
  if (isDev) return join('ffmpeg', `${platform}-${arch}`, exeName);
  return join(window.process.resourcesPath, exeName);
}

export const getFfmpegPath = () => getFfPath('ffmpeg');
export const getFfprobePath = () => getFfPath('ffprobe');

export async function runFfprobe(args, { timeout = isDev ? 10000 : 30000 } = {}) {
  const ffprobePath = getFfprobePath();
  console.log(getFfCommandLine('ffprobe', args));
  const ps = execa(ffprobePath, args);
  const timer = setTimeout(() => {
    console.warn('killing timed out ffprobe');
    ps.kill();
  }, timeout);
  try {
    return await ps;
  } finally {
    clearTimeout(timer);
  }
}

export function runFfmpeg(args, execaOptions, { logCli = true } = {}) {
  const ffmpegPath = getFfmpegPath();
  if (logCli) console.log(getFfCommandLine('ffmpeg', args));
  const process = execa(ffmpegPath, args, execaOptions);

  (async () => {
    runningFfmpegs.add(process);
    try {
      await process;
    } catch (err) {
      // ignored here
    } finally {
      runningFfmpegs.delete(process);
    }
  })();
  return process;
}

export function abortFfmpegs() {
  runningFfmpegs.forEach((process) => {
    process.kill('SIGTERM', { forceKillAfterTimeout: 10000 });
  });
}

export function handleProgress(process, durationIn, onProgress, customMatcher = () => {}) {
  if (!onProgress) return;
  onProgress(0);

  const rl = readline.createInterface({ input: process.stderr });
  rl.on('line', (line) => {
    // console.log('progress', line);

    try {
      let match = line.match(/frame=\s*[^\s]+\s+fps=\s*[^\s]+\s+q=\s*[^\s]+\s+(?:size|Lsize)=\s*[^\s]+\s+time=\s*([^\s]+)\s+/);
      // Audio only looks like this: "line size=  233422kB time=01:45:50.68 bitrate= 301.1kbits/s speed= 353x    "
      if (!match) match = line.match(/(?:size|Lsize)=\s*[^\s]+\s+time=\s*([^\s]+)\s+/);
      if (!match) {
        customMatcher(line);
        return;
      }

      const str = match[1];
      // console.log(str);
      const progressTime = Math.max(0, moment.duration(str).asSeconds());
      // console.log(progressTime);

      if (durationIn == null) return;
      const duration = Math.max(0, durationIn);
      if (duration === 0) return;
      const progress = duration ? Math.min(progressTime / duration, 1) : 0; // sometimes progressTime will be greater than cutDuration
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
  if (!isDurationValid(duration)) return true;
  return cutTo < duration;
}

function getIntervalAroundTime(time, window) {
  return {
    from: Math.max(time - window / 2, 0),
    to: time + window / 2,
  };
}

export async function readFrames({ filePath, from, to, streamIndex }) {
  const intervalsArgs = from != null && to != null ? ['-read_intervals', `${from}%${to}`] : [];
  const { stdout } = await runFfprobe(['-v', 'error', ...intervalsArgs, '-show_packets', '-select_streams', streamIndex, '-show_entries', 'packet=pts_time,flags', '-of', 'json', filePath]);
  const packetsFiltered = JSON.parse(stdout).packets
    .map(p => ({
      keyframe: p.flags[0] === 'K',
      time: parseFloat(p.pts_time, 10),
      createdAt: new Date(),
    }))
    .filter(p => !Number.isNaN(p.time));

  return sortBy(packetsFiltered, 'time');
}

export async function readFramesAroundTime({ filePath, streamIndex, aroundTime, window }) {
  if (aroundTime == null) throw new Error('aroundTime was nullish');
  const { from, to } = getIntervalAroundTime(aroundTime, window);
  return readFrames({ filePath, from, to, streamIndex });
}

export async function readKeyframesAroundTime({ filePath, streamIndex, aroundTime, window }) {
  const frames = await readFramesAroundTime({ filePath, aroundTime, streamIndex, window });
  return frames.filter((frame) => frame.keyframe);
}

export const findKeyframeAtExactTime = (keyframes, time) => keyframes.find((keyframe) => Math.abs(keyframe.time - time) < 0.000001);
export const findNextKeyframe = (keyframes, time) => keyframes.find((keyframe) => keyframe.time >= time); // (assume they are already sorted)
const findPreviousKeyframe = (keyframes, time) => keyframes.findLast((keyframe) => keyframe.time <= time);
const findNearestKeyframe = (keyframes, time) => minBy(keyframes, (keyframe) => Math.abs(keyframe.time - time));

function findKeyframe(keyframes, time, mode) {
  switch (mode) {
    case 'nearest': return findNearestKeyframe(keyframes, time);
    case 'before': return findPreviousKeyframe(keyframes, time);
    case 'after': return findNextKeyframe(keyframes, time);
    default: return undefined;
  }
}

export async function findKeyframeNearTime({ filePath, streamIndex, time, mode }) {
  let keyframes = await readKeyframesAroundTime({ filePath, streamIndex, aroundTime: time, window: 10 });
  let nearByKeyframe = findKeyframe(keyframes, time, mode);

  if (!nearByKeyframe) {
    keyframes = await readKeyframesAroundTime({ filePath, streamIndex, aroundTime: time, window: 60 });
    nearByKeyframe = findKeyframe(keyframes, time, mode);
  }

  if (!nearByKeyframe) return undefined;
  return nearByKeyframe.time;
}

// todo this is not in use
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
  const nearestKeyFrame = sortBy(keyframes, keyframe => (direction > 0 ? keyframe.time - time : time - keyframe.time))[0];
  if (!nearestKeyFrame) return undefined;
  return nearestKeyFrame.time;
}

export async function tryMapChaptersToEdl(chapters) {
  try {
    return chapters.map((chapter) => {
      const start = parseFloat(chapter.start_time);
      const end = parseFloat(chapter.end_time);
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

async function readFormatData(filePath) {
  console.log('readFormatData', filePath);

  const { stdout } = await runFfprobe([
    '-of', 'json', '-show_format', '-i', filePath, '-hide_banner',
  ]);
  return JSON.parse(stdout).format;
}


export async function getDuration(filePath) {
  return parseFloat((await readFormatData(filePath)).duration);
}

export async function createChaptersFromSegments({ segmentPaths, chapterNames }) {
  if (!chapterNames) return undefined;
  try {
    const durations = await pMap(segmentPaths, (segmentPath) => getDuration(segmentPath), { concurrency: 3 });
    let timeAt = 0;
    return durations.map((duration, i) => {
      const ret = { start: timeAt, end: timeAt + duration, name: chapterNames[i] };
      timeAt += duration;
      return ret;
    });
  } catch (err) {
    console.error('Failed to create chapters from segments', err);
    return undefined;
  }
}

/**
 * ffmpeg only supports encoding certain formats, and some of the detected input
 * formats are not the same as the muxer name used for encoding.
 * Therefore we have to map between detected input format and encode format
 * See also ffmpeg -formats
 */
function mapDefaultFormat({ streams, requestedFormat }) {
  if (requestedFormat === 'mp4') {
    // Only MOV supports these codecs, so default to MOV instead https://github.com/mifi/lossless-cut/issues/948
    if (streams.some((stream) => pcmAudioCodecs.includes(stream.codec_name))) {
      return 'mov';
    }
  }

  // see sample.aac
  if (requestedFormat === 'aac') return 'adts';

  return requestedFormat;
}

async function determineOutputFormat(ffprobeFormatsStr, filePath) {
  const ffprobeFormats = (ffprobeFormatsStr || '').split(',').map((str) => str.trim()).filter((str) => str);
  if (ffprobeFormats.length === 0) {
    console.warn('ffprobe returned unknown formats', ffprobeFormatsStr);
    return undefined;
  }

  const [firstFfprobeFormat] = ffprobeFormats;
  if (ffprobeFormats.length === 1) return firstFfprobeFormat;

  // If ffprobe returned a list of formats, try to be a bit smarter about it.
  // This should only be the case for matroska and mov. See `ffmpeg -formats`
  if (!['matroska', 'mov'].includes(firstFfprobeFormat)) {
    console.warn('Unknown ffprobe format list', ffprobeFormats);
    return firstFfprobeFormat;
  }

  const fileTypeResponse = await FileType.fromFile(filePath);
  if (fileTypeResponse == null) {
    console.warn('file-type failed to detect format, defaulting to first', ffprobeFormats);
    return firstFfprobeFormat;
  }

  // https://github.com/sindresorhus/file-type/blob/main/core.js
  // https://www.ftyps.com/
  // https://exiftool.org/TagNames/QuickTime.html
  switch (fileTypeResponse.mime) {
    case 'video/x-matroska': return 'matroska';
    case 'video/webm': return 'webm';
    case 'video/quicktime': return 'mov';
    case 'video/3gpp2': return '3g2';
    case 'video/3gpp': return '3gp';

    // These two cmds produce identical output, so we assume that encoding "ipod" means encoding m4a
    // ffmpeg -i example.aac -c copy OutputFile2.m4a
    // ffmpeg -i example.aac -c copy -f ipod OutputFile.m4a
    // See also https://github.com/mifi/lossless-cut/issues/28
    case 'audio/x-m4a':
    case 'audio/mp4':
      return 'ipod';
    case 'image/avif':
    case 'image/heif':
    case 'image/heif-sequence':
    case 'image/heic':
    case 'image/heic-sequence':
    case 'video/x-m4v':
    case 'video/mp4':
    case 'image/x-canon-cr3':
      return 'mp4';

    default: {
      console.warn('file-type returned unknown format', ffprobeFormats, fileTypeResponse.mime);
      return firstFfprobeFormat;
    }
  }
}

export async function getSmarterOutFormat({ filePath, fileMeta: { format, streams } }) {
  const formatsStr = format.format_name;
  const assumedFormat = await determineOutputFormat(formatsStr, filePath);

  return mapDefaultFormat({ streams, requestedFormat: assumedFormat });
}

export async function readFileMeta(filePath) {
  try {
    const { stdout } = await runFfprobe([
      '-of', 'json', '-show_chapters', '-show_format', '-show_entries', 'stream', '-i', filePath, '-hide_banner',
    ]);

    let parsedJson;
    try {
      // https://github.com/mifi/lossless-cut/issues/1342
      parsedJson = JSON.parse(stdout);
    } catch (err) {
      console.log('ffprobe stdout', stdout);
      throw new Error('ffprobe returned malformed data');
    }
    const { streams = [], format = {}, chapters = [] } = parsedJson;
    return { format, streams, chapters };
  } catch (err) {
    // Windows will throw error with code ENOENT if format detection fails.
    if (isExecaFailure(err)) {
      const err2 = new Error(`Unsupported file: ${err.message}`);
      err2.code = 'LLC_FFPROBE_UNSUPPORTED_FILE';
      throw err2;
    }
    throw err;
  }
}


function getPreferredCodecFormat(stream) {
  const map = {
    mp3: { format: 'mp3', ext: 'mp3' },
    opus: { format: 'opus', ext: 'opus' },
    vorbis: { format: 'ogg', ext: 'ogg' },
    h264: { format: 'mp4', ext: 'mp4' },
    hevc: { format: 'mp4', ext: 'mp4' },
    eac3: { format: 'eac3', ext: 'eac3' },

    subrip: { format: 'srt', ext: 'srt' },

    m4a: { format: 'ipod', ext: 'm4a' },
    aac: { format: 'adts', ext: 'aac' },
    jpeg: { format: 'image2', ext: 'jpeg' },
    png: { format: 'image2', ext: 'png' },

    // TODO add more
    // TODO allow user to change?
  };

  const match = map[stream.codec_name];
  if (match) return match;

  // default fallbacks:
  if (stream.codec_type === 'video') return { ext: 'mkv', format: 'matroska' };
  if (stream.codec_type === 'audio') return { ext: 'mka', format: 'matroska' };
  if (stream.codec_type === 'subtitle') return { ext: 'mks', format: 'matroska' };
  if (stream.codec_type === 'data') return { ext: 'bin', format: 'data' }; // https://superuser.com/questions/1243257/save-data-stream

  return undefined;
}

async function extractNonAttachmentStreams({ customOutDir, filePath, streams, enableOverwriteOutput }) {
  if (streams.length === 0) return [];

  console.log('Extracting', streams.length, 'normal streams');

  let streamArgs = [];
  const outPaths = await pMap(streams, async ({ index, codec, type, format: { format, ext } }) => {
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

  const { stdout } = await runFfmpeg(ffmpegArgs);
  console.log(stdout);

  return outPaths;
}

async function extractAttachmentStreams({ customOutDir, filePath, streams, enableOverwriteOutput }) {
  if (streams.length === 0) return [];

  console.log('Extracting', streams.length, 'attachment streams');

  let streamArgs = [];
  const outPaths = await pMap(streams, async ({ index, codec_name: codec, codec_type: type }) => {
    const ext = codec || 'bin';
    const outPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `stream-${index}-${type}-${codec}.${ext}` });
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
    const { stdout } = await runFfmpeg(ffmpegArgs);
    console.log(stdout);
  } catch (err) {
    // Unfortunately ffmpeg will exit with code 1 even though it's a success
    // Note: This is kind of hacky:
    if (err.exitCode === 1 && typeof err.stderr === 'string' && err.stderr.includes('At least one output file must be specified')) return outPaths;
    throw err;
  }
  return outPaths;
}

// https://stackoverflow.com/questions/32922226/extract-every-audio-and-subtitles-from-a-video-with-ffmpeg
export async function extractStreams({ filePath, customOutDir, streams, enableOverwriteOutput }) {
  const attachmentStreams = streams.filter((s) => s.codec_type === 'attachment');
  const nonAttachmentStreams = streams.filter((s) => s.codec_type !== 'attachment');

  const outStreams = nonAttachmentStreams.map((s) => ({
    index: s.index,
    codec: s.codec_name || s.codec_tag_string || s.codec_type,
    type: s.codec_type,
    format: getPreferredCodecFormat(s),
  }))
    .filter(it => it && it.format && it.index != null);

  // console.log(outStreams);

  // TODO progress

  // Attachment streams are handled differently from normal streams
  return [
    ...(await extractNonAttachmentStreams({ customOutDir, filePath, streams: outStreams, enableOverwriteOutput })),
    ...(await extractAttachmentStreams({ customOutDir, filePath, streams: attachmentStreams, enableOverwriteOutput })),
  ];
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

  const { stdout } = await runFfmpeg(args, { encoding: null });

  const blob = new Blob([stdout], { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}

export async function extractSubtitleTrack(filePath, streamId) {
  const args = [
    '-hide_banner',
    '-i', filePath,
    '-map', `0:${streamId}`,
    '-f', 'webvtt',
    '-',
  ];

  const { stdout } = await runFfmpeg(args, { encoding: null });

  const blob = new Blob([stdout], { type: 'text/vtt' });
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
    '-hide_banner',
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
    '-hide_banner',
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
    ps1 = runFfmpeg(args1, { encoding: null, buffer: false });
    ps2 = runFfmpeg(args2, { encoding: null });
    ps1.stdout.pipe(ps2.stdin);

    const timer = setTimeout(() => {
      ps1.kill();
      ps2.kill();
    }, 10000);

    let stdout;
    try {
      ({ stdout } = await ps2);
    } finally {
      clearTimeout(timer);
    }

    const blob = new Blob([stdout], { type: 'image/png' });

    return {
      url: URL.createObjectURL(blob),
      from,
      aroundTime,
      to,
      createdAt: new Date(),
    };
  } catch (err) {
    if (ps1) ps1.kill();
    if (ps2) ps2.kill();
    throw err;
  }
}

const getInputSeekArgs = ({ filePath, from, to }) => [
  ...(from != null ? ['-ss', from.toFixed(5)] : []),
  '-i', filePath,
  ...(to != null ? ['-t', (to - from).toFixed(5)] : []),
];

const getSegmentOffset = (from) => (from != null ? from : 0);

function adjustSegmentsWithOffset({ segments, from }) {
  const offset = getSegmentOffset(from);
  return segments.map(({ start, end }) => ({ start: start + offset, end: end != null ? end + offset : end }));
}

export function mapTimesToSegments(times) {
  const segments = [];
  for (let i = 0; i < times.length; i += 1) {
    const start = times[i];
    const end = times[i + 1];
    if (start != null) segments.push({ start, end }); // end undefined is allowed (means until end of video)
  }
  return segments;
}

// https://stackoverflow.com/questions/35675529/using-ffmpeg-how-to-do-a-scene-change-detection-with-timecode
export async function detectSceneChanges({ filePath, minChange, onProgress, from, to }) {
  const args = [
    '-hide_banner',
    ...getInputSeekArgs({ filePath, from, to }),
    '-filter_complex', `select='gt(scene,${minChange})',metadata=print:file=-`,
    '-f', 'null', '-',
  ];
  const process = runFfmpeg(args, { encoding: null, buffer: false });

  const times = [0];

  handleProgress(process, to - from, onProgress);
  const rl = readline.createInterface({ input: process.stdout });
  rl.on('line', (line) => {
    const match = line.match(/^frame:\d+\s+pts:\d+\s+pts_time:([\d.]+)/);
    if (!match) return;
    const time = parseFloat(match[1]);
    if (Number.isNaN(time) || time <= times[times.length - 1]) return;
    times.push(time);
  });

  await process;

  const segments = mapTimesToSegments(times);

  return adjustSegmentsWithOffset({ segments, from });
}


export async function detectIntervals({ filePath, customArgs, onProgress, from, to, matchLineTokens }) {
  const args = [
    '-hide_banner',
    ...getInputSeekArgs({ filePath, from, to }),
    ...customArgs,
    '-f', 'null', '-',
  ];
  const process = runFfmpeg(args, { encoding: null, buffer: false });

  const segments = [];

  function customMatcher(line) {
    const { start: startStr, end: endStr } = matchLineTokens(line);
    const start = parseFloat(startStr);
    const end = parseFloat(endStr);
    if (start == null || end == null || Number.isNaN(start) || Number.isNaN(end)) return;
    segments.push({ start, end });
  }
  handleProgress(process, to - from, onProgress, customMatcher);

  await process;
  return adjustSegmentsWithOffset({ segments, from });
}

const mapFilterOptions = (options) => Object.entries(options).map(([key, value]) => `${key}=${value}`).join(':');

export async function blackDetect({ filePath, filterOptions, onProgress, from, to }) {
  function matchLineTokens(line) {
    const match = line.match(/^[blackdetect\s*@\s*0x[0-9a-f]+] black_start:([\d\\.]+) black_end:([\d\\.]+) black_duration:[\d\\.]+/);
    if (!match) return {};
    return {
      start: parseFloat(match[1]),
      end: parseFloat(match[2]),
    };
  }
  const customArgs = ['-vf', `blackdetect=${mapFilterOptions(filterOptions)}`, '-an'];
  return detectIntervals({ filePath, onProgress, from, to, matchLineTokens, customArgs });
}

export async function silenceDetect({ filePath, filterOptions, onProgress, from, to }) {
  function matchLineTokens(line) {
    const match = line.match(/^[silencedetect\s*@\s*0x[0-9a-f]+] silence_end: ([\d\\.]+)[|\s]+silence_duration: ([\d\\.]+)/);
    if (!match) return {};
    const end = parseFloat(match[1]);
    const silenceDuration = parseFloat(match[2]);
    if (Number.isNaN(end) || Number.isNaN(silenceDuration)) return {};
    const start = end - silenceDuration;
    if (start < 0 || end <= 0 || start >= end) return {};
    return {
      start,
      end,
    };
  }
  const customArgs = ['-af', `silencedetect=${mapFilterOptions(filterOptions)}`, '-vn'];
  return detectIntervals({ filePath, onProgress, from, to, matchLineTokens, customArgs });
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

function getFffmpegJpegQuality(quality) {
  // Normal range for JPEG is 2-31 with 31 being the worst quality.
  const qMin = 2;
  const qMax = 31;
  return Math.min(Math.max(qMin, quality, Math.round((1 - quality) * (qMax - qMin) + qMin)), qMax);
}

export async function captureFrame({ timestamp, videoPath, outPath, quality }) {
  const ffmpegQuality = getFffmpegJpegQuality(quality);
  await runFfmpeg([
    '-ss', timestamp,
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', ffmpegQuality,
    '-y', outPath,
  ]);
}

export async function captureFrames({ from, to, videoPath, outPathTemplate, quality, filter, framePts, onProgress }) {
  const ffmpegQuality = getFffmpegJpegQuality(quality);

  const args = [
    '-ss', from,
    '-i', videoPath,
    '-t', Math.max(0, to - from),
    '-q:v', ffmpegQuality,
    ...(filter != null ? ['-vf', filter] : []),
    // https://superuser.com/questions/1336285/use-ffmpeg-for-thumbnail-selections
    ...(framePts ? ['-frame_pts', '1'] : []),
    '-vsync', '0', // else we get a ton of duplicates (thumbnail filter)
    '-y', outPathTemplate,
  ];

  const process = runFfmpeg(args, { encoding: null, buffer: false });

  handleProgress(process, to - from, onProgress);

  await process;
}

export function isIphoneHevc(format, streams) {
  if (!streams.some((s) => s.codec_name === 'hevc')) return false;
  const makeTag = format.tags && format.tags['com.apple.quicktime.make'];
  const modelTag = format.tags && format.tags['com.apple.quicktime.model'];
  return (makeTag === 'Apple' && modelTag.startsWith('iPhone'));
}

export function isProblematicAvc1(outFormat, streams) {
  // it seems like this only happens for files that are also 4.2.2 10bit (yuv422p10le)
  // https://trac.ffmpeg.org/wiki/Chroma%20Subsampling
  return isMov(outFormat) && streams.some((s) => s.codec_name === 'h264' && s.codec_tag === '0x31637661' && s.codec_tag_string === 'avc1' && s.pix_fmt === 'yuv422p10le');
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

function createRawFfmpeg({ fps = 25, path, inWidth, inHeight, seekTo, oneFrameOnly, execaOpts, streamIndex, outSize = 320 }) {
  // const fps = 25; // TODO

  const aspectRatio = inWidth / inHeight;

  let newWidth;
  let newHeight;
  if (inWidth > inHeight) {
    newWidth = outSize;
    newHeight = Math.floor(newWidth / aspectRatio);
  } else {
    newHeight = outSize;
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
    process: runFfmpeg(args, execaOpts, { logCli: false }),
    width: newWidth,
    height: newHeight,
    channels: 4,
  };
}

export function getOneRawFrame({ path, inWidth, inHeight, seekTo, streamIndex, outSize }) {
  const { process, width, height, channels } = createRawFfmpeg({ path, inWidth, inHeight, seekTo, streamIndex, oneFrameOnly: true, execaOpts: { encoding: null }, outSize });
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

function parseTimecode(str, frameRate) {
  // console.log(str, frameRate);
  const t = Timecode(str, frameRate ? parseFloat(frameRate.toFixed(3)) : undefined);
  if (!t) return undefined;
  const seconds = ((t.hours * 60) + t.minutes) * 60 + t.seconds + (t.frames / t.frameRate);
  return Number.isFinite(seconds) ? seconds : undefined;
}

export function getTimecodeFromStreams(streams) {
  console.log('Trying to load timecode');
  let foundTimecode;
  streams.find((stream) => {
    try {
      if (stream.tags && stream.tags.timecode) {
        const fps = getStreamFps(stream);
        foundTimecode = parseTimecode(stream.tags.timecode, fps);
        console.log('Loaded timecode', stream.tags.timecode, 'from stream', stream.index);
        return true;
      }
      return undefined;
    } catch (err) {
      // console.warn('Failed to parse timecode from file streams', err);
      return undefined;
    }
  });
  return foundTimecode;
}

export async function runFfmpegStartupCheck() {
  // will throw if exit code != 0
  await runFfmpeg(['-hide_banner', '-f', 'lavfi', '-i', 'nullsrc=s=256x256:d=1', '-f', 'null', '-']);
}

export async function html5ify({ outPath, filePath: filePathArg, speed, hasAudio, hasVideo, onProgress }) {
  let audio;
  if (hasAudio) {
    if (speed === 'slowest') audio = 'hq';
    else if (['slow-audio', 'fast-audio', 'fastest-audio'].includes(speed)) audio = 'lq';
    else if (['fast-audio-remux', 'fastest-audio-remux'].includes(speed)) audio = 'copy';
  }

  let video;
  if (hasVideo) {
    if (speed === 'slowest') video = 'hq';
    else if (['slow-audio', 'slow'].includes(speed)) video = 'lq';
    else video = 'copy';
  }

  console.log('Making HTML5 friendly version', { filePathArg, outPath, video, audio });

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

    '-i', filePathArg,
    ...videoArgs,
    ...audioArgs,
    '-sn',
    '-y', outPath,
  ];

  const duration = await getDuration(filePathArg);
  const process = runFfmpeg(ffmpegArgs);
  if (duration) handleProgress(process, duration, onProgress);

  const { stdout } = await process;
  console.log(stdout);
}

// https://superuser.com/questions/543589/information-about-ffmpeg-command-line-options
export const getExperimentalArgs = (ffmpegExperimental) => (ffmpegExperimental ? ['-strict', 'experimental'] : []);

export const getVideoTimescaleArgs = (videoTimebase) => (videoTimebase != null ? ['-video_track_timescale', videoTimebase] : []);

// inspired by https://gist.github.com/fernandoherreradelasheras/5eca67f4200f1a7cc8281747da08496e
export async function cutEncodeSmartPart({ filePath, cutFrom, cutTo, outPath, outFormat, videoCodec, videoBitrate, videoTimebase, allFilesMeta, copyFileStreams, videoStreamIndex, ffmpegExperimental }) {
  function getVideoArgs({ streamIndex, outputIndex }) {
    if (streamIndex !== videoStreamIndex) return undefined;

    return [
      `-c:${outputIndex}`, videoCodec,
      `-b:${outputIndex}`, videoBitrate,
    ];
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

  await runFfmpeg(ffmpegArgs);
}
