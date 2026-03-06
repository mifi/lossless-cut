import pMap from 'p-map';
import sortBy from 'lodash/sortBy';
import i18n from 'i18next';
import type { FRAMERATE } from 'smpte-timecode';
import Timecode from 'smpte-timecode';
import minBy from 'lodash/minBy';
import invariant from 'tiny-invariant';

import { pcmAudioCodecs, isMov } from './util/streams';
import { isExecaError } from './util';
import { isDurationValid } from './segments';
import type { FFprobeChapter, FFprobeFormat, FFprobeProbeResult, FFprobeStream } from '../../common/ffprobe';
import { parseSrt, parseSrtToSegments } from './edlFormats';
import { UnsupportedFileError, UserFacingError } from '../errors';
import mainApi from './mainApi';

const { ffmpeg } = window.require('@electron/remote').require('./index.js');

const { renderWaveformPng, mapTimesToSegments, detectSceneChanges, captureFrames, captureFrameToFile, captureFrameToClipboard, getFfCommandLine, runFfmpegConcat, runFfmpegWithProgress, getDuration, abortFfmpegs, runFfmpeg, runFfprobe, getFfmpegPath, setCustomFfPath } = ffmpeg;


export { renderWaveformPng, mapTimesToSegments, detectSceneChanges, captureFrames, captureFrameToFile, captureFrameToClipboard, getFfCommandLine, runFfmpegConcat, runFfmpegWithProgress, getDuration, abortFfmpegs, runFfmpeg, getFfmpegPath, setCustomFfPath };


export class RefuseOverwriteError extends Error {
  constructor() {
    super();
    this.name = 'RefuseOverwriteError';
  }
}

export function safeCreateBlob(array: Uint8Array, options?: BlobPropertyBag) {
  // if we don't do this when creating a Blob, we get:
  // "Failed to construct 'Blob': The provided ArrayBufferView value must not be resizable."
  // maybe when moving away from @electron/remote, it's not needed anymore?
  // https://stackoverflow.com/a/25255750/6519037
  const cloned = new Uint8Array(array);
  return new Blob([cloned], options);
}

export function logStdoutStderr({ stdout, stderr }: { stdout: Uint8Array, stderr: Uint8Array }) {
  if (stdout.length > 0) {
    console.log('%cSTDOUT:', 'color: green; font-weight: bold');
    console.log(new TextDecoder().decode(stdout));
  }
  if (stderr.length > 0) {
    console.log('%cSTDERR:', 'color: blue; font-weight: bold');
    console.log(new TextDecoder().decode(stderr));
  }
}

export function isCuttingStart(cutFrom: number) {
  return cutFrom > 0;
}

export function isCuttingEnd(cutTo: number, fileDuration: number | undefined) {
  if (!isDurationValid(fileDuration)) return true;
  return cutTo < fileDuration;
}

function getIntervalAroundTime(time: number, window: number) {
  return {
    from: Math.max(time - window / 2, 0),
    to: time + window / 2,
  };
}

export interface Frame {
  time: number,
  createdAt: Date,
  keyframe: boolean
}

export async function readFrames({ filePath, from, to, streamIndex }: {
  filePath: string,
  from?: number | undefined,
  to?: number | undefined,
  streamIndex: number,
}) {
  const intervalsArgs = from != null && to != null ? ['-read_intervals', `${from}%${to}`] : [];
  const { stdout } = await runFfprobe(['-v', 'error', ...intervalsArgs, '-show_packets', '-select_streams', String(streamIndex), '-show_entries', 'packet=pts_time,flags', '-of', 'json', filePath], { logCli: false });
  const createdAt = new Date();
  const packetsFiltered: Frame[] = (JSON.parse(new TextDecoder().decode(stdout)).packets as { flags: string, pts_time: string }[])
    .map((p) => ({
      keyframe: p.flags[0] === 'K',
      time: parseFloat(p.pts_time),
      createdAt,
    }))
    .filter((p) => !Number.isNaN(p.time));

  return sortBy(packetsFiltered, 'time');
}

export async function readFramesAroundTime({ filePath, streamIndex, aroundTime, window }: { filePath: string, streamIndex: number, aroundTime: number, window: number }) {
  invariant(aroundTime != null);
  const { from, to } = getIntervalAroundTime(aroundTime, window);
  return readFrames({ filePath, from, to, streamIndex });
}

export async function readKeyframesAroundTime({ filePath, streamIndex, aroundTime, window }: { filePath: string, streamIndex: number, aroundTime: number, window: number }) {
  const frames = await readFramesAroundTime({ filePath, aroundTime, streamIndex, window });
  return frames.filter((frame) => frame.keyframe);
}

export const findKeyframeAtExactTime = (keyframes: Frame[], time: number) => keyframes.find((keyframe) => Math.abs(keyframe.time - time) < 0.000001);
export const findNextKeyframe = (keyframes: Frame[], time: number) => keyframes.find((keyframe) => keyframe.time >= time); // (assume they are already sorted)
const findPreviousKeyframe = (keyframes: Frame[], time: number) => keyframes.findLast((keyframe) => keyframe.time <= time);
const findNearestKeyframe = (keyframes: Frame[], time: number) => minBy(keyframes, (keyframe) => Math.abs(keyframe.time - time));

export type FindKeyframeMode = 'nearest' | 'before' | 'after';

function findKeyframe(keyframes: Frame[], time: number, mode: FindKeyframeMode) {
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
export function getSafeCutTime(frames: Frame[], cutTime: number, nextMode: boolean) {
  const sigma = 0.01;
  const isCloseTo = (time1: number, time2: number) => Math.abs(time1 - time2) < sigma;

  let index: number;

  if (frames.length < 2) throw new UserFacingError(i18n.t('Less than 2 frames found'));

  if (nextMode) {
    index = frames.findIndex((f) => f.keyframe && f.time >= cutTime - sigma);
    if (index === -1) throw new UserFacingError(i18n.t('Failed to find next keyframe'));
    if (index >= frames.length - 1) throw new UserFacingError(i18n.t('We are on the last frame'));
    const { time } = frames[index]!;
    if (isCloseTo(time, cutTime)) {
      return undefined; // Already on keyframe, no need to modify cut time
    }
    return time;
  }

  const findReverseIndex = <T>(arr: T[], cb: (value: T, i: number, obj: T[]) => unknown) => {
    // eslint-disable-next-line unicorn/no-array-callback-reference
    const ret = [...arr].reverse().findIndex(cb);
    if (ret === -1) return -1;
    return arr.length - 1 - ret;
  };

  index = findReverseIndex(frames, (f) => f.time <= cutTime + sigma);
  if (index === -1) throw new UserFacingError(i18n.t('Failed to find any prev frame'));
  if (index === 0) throw new UserFacingError(i18n.t('We are on the first frame'));

  if (index === frames.length - 1) {
    // Last frame of video, no need to modify cut time
    return undefined;
  }
  if (frames[index + 1]!.keyframe) {
    // Already on frame before keyframe, no need to modify cut time
    return undefined;
  }

  // We are not on a frame before keyframe, look for preceding keyframe instead
  index = findReverseIndex(frames, (f) => f.keyframe && f.time <= cutTime + sigma);
  if (index === -1) throw new UserFacingError(i18n.t('Failed to find any prev keyframe'));
  if (index === 0) throw new UserFacingError(i18n.t('We are on the first keyframe'));

  // Use frame before the found keyframe
  return frames[index - 1]!.time;
}

export function findNearestKeyFrameTime({ frames, time, direction, fps }: { frames: Frame[], time: number, direction: number, fps: number | undefined }) {
  const sigma = fps ? (1 / fps) : 0.1;
  const keyframes = frames.filter((f) => f.keyframe && (direction > 0 ? f.time > time + sigma : f.time < time - sigma));
  if (keyframes.length === 0) return undefined;
  const nearestKeyFrame = sortBy(keyframes, (keyframe) => (direction > 0 ? keyframe.time - time : time - keyframe.time))[0];
  if (!nearestKeyFrame) return undefined;
  return nearestKeyFrame.time;
}

export function tryMapChaptersToEdl(chapters: FFprobeChapter[]) {
  try {
    return chapters.flatMap((chapter) => {
      const start = parseFloat(chapter.start_time);
      const end = parseFloat(chapter.end_time);
      if (Number.isNaN(start) || Number.isNaN(end)) return [];

      const name = chapter.tags && typeof chapter.tags.title === 'string' ? chapter.tags.title : undefined;

      return [{
        start,
        end,
        name,
      }];
    });
  } catch (err) {
    console.error('Failed to read chapters from file', err);
    return [];
  }
}

export async function createChaptersFromSegments({ segmentPaths, chapterNames }: { segmentPaths: string[], chapterNames?: (string | undefined)[] | undefined }) {
  if (!chapterNames) return undefined;
  try {
    const durations = await pMap(segmentPaths, async (segmentPath) => (await getDuration(segmentPath)) ?? 0, { concurrency: 3 });
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
 * Some of the detected input formats are not the same as the muxer name used for encoding.
 * Therefore we have to map between detected input format and encode format
 * See also ffmpeg -formats
 */
function mapInputToOutputFormat(requestedFormat: string | undefined) {
  // see file aac raw adts.aac
  if (requestedFormat === 'aac') return 'adts';

  return requestedFormat;
}

export function mapRecommendedDefaultFormat({ streams, sourceFormat }: { streams: FFprobeStream[], sourceFormat: string | undefined }) {
  // Certain codecs cannot be muxed by ffmpeg into mp4, but in MOV they can
  // so we default to MOV instead in those cases https://github.com/mifi/lossless-cut/issues/948
  if (sourceFormat === 'mp4' && streams.some((stream) => pcmAudioCodecs.includes(stream.codec_name))) {
    return { format: 'mov', message: i18n.t('This file contains an audio track that FFmpeg is unable to mux into the MP4 format, so MOV has been auto-selected as the default output format.') };
  }

  return { format: sourceFormat };
}

async function determineSourceFileFormat(ffprobeFormatsStr: string | undefined, filePath: string) {
  const ffprobeFormats = (ffprobeFormatsStr || '').split(',').map((str) => str.trim()).filter(Boolean);

  const [firstFfprobeFormat] = ffprobeFormats;

  if (firstFfprobeFormat == null) {
    console.warn('FFprobe returned no formats', ffprobeFormatsStr);
    return undefined;
  }

  console.log('FFprobe detected format(s)', ffprobeFormatsStr);

  if (ffprobeFormats.length === 1) {
    return firstFfprobeFormat;
  }

  // If ffprobe returned a list of formats, use `file-type` to try to detect more accurately.
  // This should only be the case for matroska (matroska,webm) and mov (mov,mp4,m4a,3gp,3g2,mj2),
  // so if it's another format, then just return the first format from the list.
  // See also `ffmpeg -formats`
  if (!['matroska', 'mov'].includes(firstFfprobeFormat)) {
    console.warn('Unknown ffprobe format list', ffprobeFormats);
    return firstFfprobeFormat;
  }

  const fileTypeResponse = await mainApi.fileTypeFromFile(filePath);
  if (fileTypeResponse == null) {
    console.warn('file-type failed to detect format, defaulting to first FFprobe detected format', ffprobeFormats);
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

export async function getDefaultOutFormat({ filePath, fileMeta: { format } }: { filePath: string, fileMeta: { format: Pick<FFprobeFormat, 'format_name'> } }) {
  const assumedFormat = await determineSourceFileFormat(format.format_name, filePath);

  return mapInputToOutputFormat(assumedFormat);
}

export async function readFileFfprobeMeta(filePath: string) {
  try {
    const { stdout } = await runFfprobe([
      '-of', 'json', '-show_chapters', '-show_format', '-show_entries', 'stream', '-i', filePath, '-hide_banner',
    ]);

    let parsedJson: FFprobeProbeResult;
    let decoded: string | undefined;
    try {
      // https://github.com/mifi/lossless-cut/issues/1342
      decoded = new TextDecoder().decode(stdout);
      parsedJson = JSON.parse(decoded);
    } catch {
      console.log('ffprobe stdout:', decoded ?? stdout);
      throw new Error('ffprobe returned malformed data');
    }
    const { format, chapters = [] } = parsedJson;
    invariant(format != null);

    const streams = (parsedJson.streams ?? []).map((s) => {
      if (/DJI_[^/\\]+SRT$/.test(filePath)) {
        return { ...s, guessedType: 'dji-gps-srt' as const };
      }
      return { ...s, guessedType: undefined };
    });
    return { format, streams, chapters };
  } catch (err) {
    if (isExecaError(err) && err.code == null && err.exitCode != null) {
      throw new UnsupportedFileError('Unsupported file', { cause: err });
    }
    throw err;
  }
}

export type FileFfprobeMeta = Awaited<ReturnType<typeof readFileFfprobeMeta>>;
export type FileStream = FileFfprobeMeta['streams'][number];

export async function createChaptersFromOriginalFiles({ paths, createChapterForFilesWithoutChapters }: { paths: string[], createChapterForFilesWithoutChapters: boolean }) {
  const { parse } = window.require('path') as { parse: (p: string) => { name: string } };
  try {
    const mergedChapters: { start: number, end: number, name: string | undefined }[] = [];
    let offset = 0;
    for (const path of paths) {
      const meta = await readFileFfprobeMeta(path);
      const duration = (await getDuration(path)) ?? 0;
      const chapters = meta.chapters ?? [];
      if (chapters.length > 0) {
        for (const ch of chapters) {
          mergedChapters.push({
            start: offset + parseFloat(ch.start_time),
            end: offset + parseFloat(ch.end_time),
            name: ch.tags?.title ?? undefined,
          });
        }
      } else if (createChapterForFilesWithoutChapters) {
        mergedChapters.push({ start: offset, end: offset + duration, name: parse(path).name });
      }
      offset += duration;
    }
    return mergedChapters.length > 0 ? mergedChapters : undefined;
  } catch (err) {
    console.error('Failed to create chapters from original files', err);
    return undefined;
  }
}

async function renderThumbnail(filePath: string, timestamp: number, signal: AbortSignal) {
  const args = [
    '-ss', String(timestamp),
    '-i', filePath,
    '-vf', 'scale=-2:200',
    '-f', 'image2',
    '-vframes', '1',
    '-q:v', '10',
    '-',
  ];

  const { stdout } = await runFfmpeg(args, { cancelSignal: signal }, { logCli: false });

  const blob = safeCreateBlob(stdout, { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}

export async function extractSubtitleTrack(filePath: string, streamId: number) {
  const args = [
    '-hide_banner',
    '-i', filePath,
    '-map', `0:${streamId}`,
    '-f', 'srt',
    '-',
  ];

  const { stdout } = await runFfmpeg(args);
  return new TextDecoder().decode(stdout);
}

export async function extractSubtitleTrackToSegments(filePath: string, streamId: number) {
  const srt = await extractSubtitleTrack(filePath, streamId);
  return parseSrtToSegments(srt);
}

export async function extractSrtGpsTrack(filePath: string, streamId: number) {
  const srt = await extractSubtitleTrack(filePath, streamId);
  return parseSrt(srt);
}

export async function extractSubtitleTrackVtt(filePath: string, streamId: number) {
  const args = [
    '-hide_banner',
    '-i', filePath,
    '-map', `0:${streamId}`,
    '-f', 'webvtt',
    '-',
  ];

  const { stdout } = await runFfmpeg(args);

  const blob = safeCreateBlob(stdout, { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}

export async function renderThumbnails({ filePath, from, duration, onThumbnail, signal }: {
  filePath: string,
  from: number,
  duration: number,
  onThumbnail: (a: { time: number, url: string }) => void,
  signal: AbortSignal,
}) {
  const numThumbs = 10;
  const thumbTimes = Array.from({ length: numThumbs }).fill(undefined).map((_unused, i) => (from + ((duration * i) / numThumbs)));
  // console.log(thumbTimes);

  await pMap(thumbTimes, async (time) => {
    const url = await renderThumbnail(filePath, time, signal);
    onThumbnail({ time, url });
  }, { concurrency: 2 });
}

export async function extractWaveform({ filePath, outPath }: { filePath: string, outPath: string }) {
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
  ], undefined, { logCli: false });
  console.timeEnd('ffmpeg');
}

export function isIphoneHevc(format: FFprobeFormat, streams: FFprobeStream[]) {
  if (!streams.some((s) => s.codec_name === 'hevc')) return false;
  const makeTag = format.tags && format.tags['com.apple.quicktime.make'];
  const modelTag = format.tags && format.tags['com.apple.quicktime.model'];
  return (makeTag === 'Apple' && modelTag?.startsWith('iPhone'));
}

export function isProblematicAvc1(outFormat: string | undefined, streams: FFprobeStream[]) {
  // it seems like this only happens for files that are also 4.2.2 10bit (yuv422p10le)
  // https://trac.ffmpeg.org/wiki/Chroma%20Subsampling
  return isMov(outFormat) && streams.some((s) => s.codec_name === 'h264' && s.codec_tag === '0x31637661' && s.codec_tag_string === 'avc1' && s.pix_fmt === 'yuv422p10le');
}

function parseFfprobeFps(stream: FFprobeStream) {
  const match = typeof stream.avg_frame_rate === 'string' && stream.avg_frame_rate.match(/^(\d+)\/(\d+)$/);
  if (!match) return undefined;
  const num = parseInt(match[1]!, 10);
  const den = parseInt(match[2]!, 10);
  if (den > 0) return num / den;
  return undefined;
}

export function getStreamFps(stream: FFprobeStream) {
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


function parseTimecode(str: string, frameRate?: number | undefined) {
  // console.log(str, frameRate);
  const t = Timecode(str, frameRate ? parseFloat(frameRate.toFixed(3)) as FRAMERATE : undefined);
  if (!t) return undefined;
  const seconds = ((t.hours * 60) + t.minutes) * 60 + t.seconds + (t.frames / t.frameRate);
  return Number.isFinite(seconds) ? seconds : undefined;
}

export function getTimecodeFromStreams(streams: FFprobeStream[]) {
  console.log('Trying to load timecode');
  let foundTimecode: number | undefined;
  streams.find((stream) => {
    try {
      if (stream.tags && stream.tags['timecode']) {
        const fps = getStreamFps(stream);
        foundTimecode = parseTimecode(stream.tags['timecode'], fps);
        console.log('Loaded timecode', stream.tags['timecode'], 'from stream', stream.index);
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
