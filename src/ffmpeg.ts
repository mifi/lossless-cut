import pMap from 'p-map';
import sortBy from 'lodash/sortBy';
import i18n from 'i18next';
import Timecode from 'smpte-timecode';
import minBy from 'lodash/minBy';

import { pcmAudioCodecs, getMapStreamsArgs, isMov } from './util/streams';
import { getSuffixedOutPath, isExecaFailure } from './util';
import { isDurationValid } from './segments';

const FileType = window.require('file-type');
const { pathExists } = window.require('fs-extra');

const remote = window.require('@electron/remote');

const { renderWaveformPng, mapTimesToSegments, detectSceneChanges, captureFrames, captureFrame, getFfCommandLine, runFfmpegConcat, runFfmpegWithProgress, html5ify, getDuration, abortFfmpegs, runFfmpeg, runFfprobe, getFfmpegPath, setCustomFfPath } = remote.require('./ffmpeg');


export { renderWaveformPng, mapTimesToSegments, detectSceneChanges, captureFrames, captureFrame, getFfCommandLine, runFfmpegConcat, runFfmpegWithProgress, html5ify, getDuration, abortFfmpegs, runFfprobe, getFfmpegPath, setCustomFfPath };


export class RefuseOverwriteError extends Error {
  constructor() {
    super();
    this.name = 'RefuseOverwriteError';
  }
}

export function logStdoutStderr({ stdout, stderr }) {
  if (stdout.length > 0) {
    console.log('%cSTDOUT:', 'color: green; font-weight: bold');
    console.log(stdout);
  }
  if (stderr.length > 0) {
    console.log('%cSTDERR:', 'color: blue; font-weight: bold');
    console.log(stderr);
  }
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

interface Keyframe {
  time: number,
  createdAt: Date,
}

interface Frame extends Keyframe {
  keyframe: boolean
}

export async function readFrames({ filePath, from, to, streamIndex }) {
  const intervalsArgs = from != null && to != null ? ['-read_intervals', `${from}%${to}`] : [];
  const { stdout } = await runFfprobe(['-v', 'error', ...intervalsArgs, '-show_packets', '-select_streams', streamIndex, '-show_entries', 'packet=pts_time,flags', '-of', 'json', filePath]);
  // todo types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packetsFiltered: Frame[] = (JSON.parse(stdout).packets as any[])
    .map((p) => ({
      keyframe: p.flags[0] === 'K',
      time: parseFloat(p.pts_time),
      createdAt: new Date(),
    }))
    .filter((p) => !Number.isNaN(p.time));

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

export const findKeyframeAtExactTime = (keyframes: Keyframe[], time: number) => keyframes.find((keyframe) => Math.abs(keyframe.time - time) < 0.000001);
export const findNextKeyframe = (keyframes: Keyframe[], time: number) => keyframes.find((keyframe) => keyframe.time >= time); // (assume they are already sorted)
const findPreviousKeyframe = (keyframes: Keyframe[], time: number) => keyframes.findLast((keyframe) => keyframe.time <= time);
const findNearestKeyframe = (keyframes: Keyframe[], time: number) => minBy(keyframes, (keyframe) => Math.abs(keyframe.time - time));

export type FindKeyframeMode = 'nearest' | 'before' | 'after';

function findKeyframe(keyframes: Keyframe[], time: number, mode: FindKeyframeMode) {
  switch (mode) {
    case 'nearest': {
      return findNearestKeyframe(keyframes, time);
    }
    case 'before': {
      return findPreviousKeyframe(keyframes, time);
    }
    case 'after': {
      return findNextKeyframe(keyframes, time);
    }
    default: {
      return undefined;
    }
  }
}

export async function findKeyframeNearTime({ filePath, streamIndex, time, mode }: { filePath: string, streamIndex: number, time: number, mode: FindKeyframeMode }) {
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
    index = frames.findIndex((f) => f.keyframe && f.time >= cutTime - sigma);
    if (index === -1) throw new Error(i18n.t('Failed to find next keyframe'));
    if (index >= frames.length - 1) throw new Error(i18n.t('We are on the last frame'));
    const { time } = frames[index];
    if (isCloseTo(time, cutTime)) {
      return undefined; // Already on keyframe, no need to modify cut time
    }
    return time;
  }

  const findReverseIndex = (arr, cb) => {
    // eslint-disable-next-line unicorn/no-array-callback-reference
    const ret = [...arr].reverse().findIndex(cb);
    if (ret === -1) return -1;
    return arr.length - 1 - ret;
  };

  index = findReverseIndex(frames, (f) => f.time <= cutTime + sigma);
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
  index = findReverseIndex(frames, (f) => f.keyframe && f.time <= cutTime + sigma);
  if (index === -1) throw new Error(i18n.t('Failed to find any prev keyframe'));
  if (index === 0) throw new Error(i18n.t('We are on the first keyframe'));

  // Use frame before the found keyframe
  return frames[index - 1].time;
}

export function findNearestKeyFrameTime({ frames, time, direction, fps }) {
  const sigma = fps ? (1 / fps) : 0.1;
  const keyframes = frames.filter((f) => f.keyframe && (direction > 0 ? f.time > time + sigma : f.time < time - sigma));
  if (keyframes.length === 0) return undefined;
  const nearestKeyFrame = sortBy(keyframes, (keyframe) => (direction > 0 ? keyframe.time - time : time - keyframe.time))[0];
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
    }).filter(Boolean);
  } catch (err) {
    console.error('Failed to read chapters from file', err);
    return [];
  }
}

export async function createChaptersFromSegments({ segmentPaths, chapterNames }: { segmentPaths: string[], chapterNames?: string[] }) {
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
    // eslint-disable-next-line unicorn/no-lonely-if
    if (streams.some((stream) => pcmAudioCodecs.includes(stream.codec_name))) {
      return 'mov';
    }
  }

  // see sample.aac
  if (requestedFormat === 'aac') return 'adts';

  return requestedFormat;
}

async function determineOutputFormat(ffprobeFormatsStr, filePath) {
  const ffprobeFormats = (ffprobeFormatsStr || '').split(',').map((str) => str.trim()).filter(Boolean);
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
    case 'video/x-matroska': {
      return 'matroska';
    }
    case 'video/webm': {
      return 'webm';
    }
    case 'video/quicktime': {
      return 'mov';
    }
    case 'video/3gpp2': {
      return '3g2';
    }
    case 'video/3gpp': {
      return '3gp';
    }

    // These two cmds produce identical output, so we assume that encoding "ipod" means encoding m4a
    // ffmpeg -i example.aac -c copy OutputFile2.m4a
    // ffmpeg -i example.aac -c copy -f ipod OutputFile.m4a
    // See also https://github.com/mifi/lossless-cut/issues/28
    case 'audio/x-m4a':
    case 'audio/mp4': {
      return 'ipod';
    }
    case 'image/avif':
    case 'image/heif':
    case 'image/heif-sequence':
    case 'image/heic':
    case 'image/heic-sequence':
    case 'video/x-m4v':
    case 'video/mp4':
    case 'image/x-canon-cr3': {
      return 'mp4';
    }

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
    } catch {
      console.log('ffprobe stdout', stdout);
      throw new Error('ffprobe returned malformed data');
    }
    const { streams = [], format = {}, chapters = [] } = parsedJson;
    return { format, streams, chapters };
  } catch (err) {
    // Windows will throw error with code ENOENT if format detection fails.
    if (isExecaFailure(err)) {
      throw Object.assign(new Error(`Unsupported file: ${err.message}`), { code: 'LLC_FFPROBE_UNSUPPORTED_FILE' });
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
    mov_text: { format: 'mp4', ext: 'mp4' },

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

async function extractNonAttachmentStreams({ customOutDir, filePath, streams, enableOverwriteOutput }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customOutDir?: string, filePath: string, streams: any[], enableOverwriteOutput?: boolean,
}) {
  if (streams.length === 0) return [];

  const outStreams = streams.map((s) => ({
    index: s.index,
    codec: s.codec_name || s.codec_tag_string || s.codec_type,
    type: s.codec_type,
    format: getPreferredCodecFormat(s),
  }))
    .filter(({ format, index }) => format != null && index != null);

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

  const { stdout } = await runFfmpeg(ffmpegArgs);
  console.log(stdout);

  return outPaths;
}

async function extractAttachmentStreams({ customOutDir, filePath, streams, enableOverwriteOutput }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customOutDir?: string, filePath: string, streams: any[], enableOverwriteOutput?: boolean,
}) {
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
    const { stdout } = await runFfmpeg(ffmpegArgs);
    console.log(stdout);
  } catch (err) {
    // Unfortunately ffmpeg will exit with code 1 even though it's a success
    // Note: This is kind of hacky:
    if (err instanceof Error && 'exitCode' in err && 'stderr' in err && err.exitCode === 1 && typeof err.stderr === 'string' && err.stderr.includes('At least one output file must be specified')) return outPaths;
    throw err;
  }
  return outPaths;
}

// https://stackoverflow.com/questions/32922226/extract-every-audio-and-subtitles-from-a-video-with-ffmpeg
export async function extractStreams({ filePath, customOutDir, streams, enableOverwriteOutput }) {
  const attachmentStreams = streams.filter((s) => s.codec_type === 'attachment');
  const nonAttachmentStreams = streams.filter((s) => s.codec_type !== 'attachment');

  // TODO progress

  // Attachment streams are handled differently from normal streams
  return [
    ...(await extractNonAttachmentStreams({ customOutDir, filePath, streams: nonAttachmentStreams, enableOverwriteOutput })),
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
  const startTime = Date.now() / 1000;
  let url = await renderThumbnail(filePath, from);
  const endTime = Date.now() / 1000;
  onThumbnail({ time: from, url });

  // Aim for max 3 sec to render all
  const numThumbs = Math.floor(Math.min(Math.max(3 / (endTime - startTime), 3), 10));
  // console.log(numThumbs);

  const thumbTimes = Array.from({ length: numThumbs - 1 }).fill(undefined).map((_unused, i) => (from + ((duration * (i + 1)) / (numThumbs))));
  // console.log(thumbTimes);

  await pMap(thumbTimes, async (time) => {
    url = await renderThumbnail(filePath, time);
    onThumbnail({ time, url });
  }, { concurrency: 2 });
}

export async function extractWaveform({ filePath, outPath }) {
  const numSegs = 10;
  const duration = 60 * 60;
  const maxLen = 0.1;
  const segments = Array.from({ length: numSegs }).fill(undefined).map((_unused, i) => [i * (duration / numSegs), Math.min(duration / numSegs, maxLen)] as const);

  // https://superuser.com/questions/681885/how-can-i-remove-multiple-segments-from-a-video-using-ffmpeg
  let filter = segments.map(([from, len], i) => `[0:a]atrim=start=${from}:end=${from + len},asetpts=PTS-STARTPTS[a${i}]`).join(';');
  filter += ';';
  filter += segments.map((_arr, i) => `[a${i}]`).join('');
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

function parseFfprobeFps(stream) {
  const match = typeof stream.avg_frame_rate === 'string' && stream.avg_frame_rate.match(/^(\d+)\/(\d+)$/);
  if (!match) return undefined;
  const num = parseInt(match[1], 10);
  const den = parseInt(match[2], 10);
  if (den > 0) return num / den;
  return undefined;
}

export function getStreamFps(stream) {
  if (stream.codec_type === 'video') {
    const fps = parseFfprobeFps(stream);
    return fps;
  }
  if (stream.codec_type === 'audio') {
    // eslint-disable-next-line unicorn/no-lonely-if
    if (typeof stream.sample_rate === 'string') {
      const sampleRate = parseInt(stream.sample_rate, 10);
      if (!Number.isNaN(sampleRate) && sampleRate > 0) {
        if (stream.codec_name === 'mp3') {
          // https://github.com/mifi/lossless-cut/issues/1754#issuecomment-1774107468
          const frameSize = 1152;
          return sampleRate / frameSize;
        }
        if (stream.codec_name === 'aac') {
          // https://stackoverflow.com/questions/59173435/aac-packet-size
          const frameSize = 1024;
          return sampleRate / frameSize;
        }
      }
    }
  }
  return undefined;
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
    } catch {
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

// https://superuser.com/questions/543589/information-about-ffmpeg-command-line-options
export const getExperimentalArgs = (ffmpegExperimental: boolean) => (ffmpegExperimental ? ['-strict', 'experimental'] : []);

export const getVideoTimescaleArgs = (videoTimebase: number | undefined) => (videoTimebase != null ? ['-video_track_timescale', String(videoTimebase)] : []);

// inspired by https://gist.github.com/fernandoherreradelasheras/5eca67f4200f1a7cc8281747da08496e
export async function cutEncodeSmartPart({ filePath, cutFrom, cutTo, outPath, outFormat, videoCodec, videoBitrate, videoTimebase, allFilesMeta, copyFileStreams, videoStreamIndex, ffmpegExperimental }: {
  filePath: string, cutFrom: number, cutTo: number, outPath: string, outFormat: string, videoCodec: string, videoBitrate: number, videoTimebase: number, allFilesMeta, copyFileStreams, videoStreamIndex: number, ffmpegExperimental: boolean,
}) {
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

  await runFfmpeg(ffmpegArgs);
}
