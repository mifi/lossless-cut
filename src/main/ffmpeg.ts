import { join } from 'node:path';
import readline from 'node:readline';
import stringToStream from 'string-to-stream';
import { BufferEncodingOption, execa, ExecaChildProcess, Options as ExecaOptions } from 'execa';
import assert from 'node:assert';
import { Readable } from 'node:stream';
// eslint-disable-next-line import/no-extraneous-dependencies
import { app } from 'electron';

import { platform, arch, isWindows, isLinux } from './util.js';
import { CaptureFormat, Waveform } from '../../types.js';
import isDev from './isDev.js';
import logger from './logger.js';
import { parseFfmpegProgressLine } from './progress.js';


const runningFfmpegs = new Set<ExecaChildProcess<Buffer>>();
// setInterval(() => console.log(runningFfmpegs.size), 1000);

let customFfPath: string | undefined;

// Note that this does not work on MAS because of sandbox restrictions
export function setCustomFfPath(path: string | undefined) {
  customFfPath = path;
}

function escapeCliArg(arg: string) {
  // todo change String(arg) => arg when ts no-implicit-any is turned on
  if (isWindows) {
    // https://github.com/mifi/lossless-cut/issues/2151
    return /[\s"&<>^|]/.test(arg) ? `"${String(arg).replaceAll('"', '""')}"` : arg;
  }
  return /[^\w-]/.test(arg) ? `'${String(arg).replaceAll("'", '\'"\'"\'')}'` : arg;
}

export function getFfCommandLine(cmd: string, args: readonly string[]) {
  return `${cmd} ${args.map((arg) => escapeCliArg(arg)).join(' ')}`;
}

function getFfPath(cmd: string) {
  const exeName = isWindows ? `${cmd}.exe` : cmd;

  if (customFfPath) return join(customFfPath, exeName);

  if (app.isPackaged) {
    return join(process.resourcesPath, exeName);
  }

  // local dev
  const components = ['ffmpeg', `${platform}-${arch}`];
  if (isWindows || isLinux) components.push('lib');
  components.push(exeName);
  return join(...components);
}

const getFfprobePath = () => getFfPath('ffprobe');
export const getFfmpegPath = () => getFfPath('ffmpeg');

export function abortFfmpegs() {
  logger.info('Aborting', runningFfmpegs.size, 'ffmpeg process(es)');
  runningFfmpegs.forEach((process) => {
    process.kill('SIGTERM', { forceKillAfterTimeout: 10000 });
  });
}

function handleProgress(
  process: { stderr: Readable | null },
  duration: number | undefined,
  onProgress: (a: number) => void,
  customMatcher?: (a: string) => void,
) {
  if (!onProgress) return;
  if (process.stderr == null) return;
  onProgress(0);

  const rl = readline.createInterface({ input: process.stderr });
  rl.on('line', (line) => {
    // console.log('progress', line);

    try {
      const progress = parseFfmpegProgressLine({ line, customMatcher, duration });
      if (progress != null) {
        onProgress(progress);
      }
    } catch (err) {
      logger.error('Failed to parse ffmpeg progress line:', err instanceof Error ? err.message : err);
    }
  });
}

function getExecaOptions({ env, ...customExecaOptions }: Omit<ExecaOptions<BufferEncodingOption>, 'buffer'> = {}) {
  const execaOptions: Omit<ExecaOptions<BufferEncodingOption>, 'buffer'> = { ...customExecaOptions, encoding: 'buffer' };
  // https://github.com/mifi/lossless-cut/issues/1143#issuecomment-1500883489
  if (isLinux && !isDev && !customFfPath) {
    return {
      ...execaOptions,
      env: { ...env, LD_LIBRARY_PATH: process.resourcesPath },
    };
  }
  return execaOptions;
}

// todo collect warnings from ffmpeg output and show them after export? example: https://github.com/mifi/lossless-cut/issues/1469
function runFfmpegProcess(args: readonly string[], customExecaOptions?: Omit<ExecaOptions<BufferEncodingOption>, 'encoding'>, additionalOptions?: { logCli?: boolean }) {
  const ffmpegPath = getFfmpegPath();
  const { logCli = true } = additionalOptions ?? {};
  if (logCli) logger.info(getFfCommandLine('ffmpeg', args));

  const process = execa(ffmpegPath, args, getExecaOptions(customExecaOptions));

  (async () => {
    runningFfmpegs.add(process);
    try {
      await process;
    } catch {
      // ignored here
    } finally {
      runningFfmpegs.delete(process);
    }
  })();
  return process;
}

export async function runFfmpegConcat({ ffmpegArgs, concatTxt, totalDuration, onProgress }: {
  ffmpegArgs: string[], concatTxt: string, totalDuration: number, onProgress: (a: number) => void
}) {
  const process = runFfmpegProcess(ffmpegArgs);

  handleProgress(process, totalDuration, onProgress);

  assert(process.stdin != null);
  stringToStream(concatTxt).pipe(process.stdin);

  return process;
}

export async function runFfmpegWithProgress({ ffmpegArgs, duration, onProgress }: {
  ffmpegArgs: string[],
  duration?: number | undefined,
  onProgress: (a: number) => void,
}) {
  const process = runFfmpegProcess(ffmpegArgs);
  assert(process.stderr != null);
  handleProgress(process, duration, onProgress);
  return process;
}

export async function runFfprobe(args: readonly string[], { timeout = isDev ? 10000 : 30000, logCli = true } = {}) {
  const ffprobePath = getFfprobePath();
  if (logCli) logger.info(getFfCommandLine('ffprobe', args));
  const ps = execa(ffprobePath, args, getExecaOptions());
  const timer = setTimeout(() => {
    logger.warn('killing timed out ffprobe');
    ps.kill();
  }, timeout);
  try {
    return await ps;
  } finally {
    clearTimeout(timer);
  }
}

export async function renderWaveformPng({ filePath, start, duration, color, streamIndex }: {
  filePath: string, start: number, duration: number, color: string, streamIndex: number,
}): Promise<Waveform> {
  const args1 = [
    '-hide_banner',
    '-i', filePath,
    '-ss', String(start),
    '-t', String(duration),
    '-c', 'copy',
    '-vn',
    '-map', `0:${streamIndex}`,
    '-f', 'matroska', // mpegts doesn't support vorbis etc
    '-',
  ];

  const args2 = [
    '-hide_banner',
    '-i', '-',
    '-filter_complex', `showwavespic=s=2000x300:scale=lin:filter=peak:split_channels=1:colors=${color}`,
    '-frames:v', '1',
    '-vcodec', 'png',
    '-f', 'image2',
    '-',
  ];

  logger.info(`${getFfCommandLine('ffmpeg1', args1)} | \n${getFfCommandLine('ffmpeg2', args2)}`);

  let ps1: ExecaChildProcess<Buffer> | undefined;
  let ps2: ExecaChildProcess<Buffer> | undefined;
  try {
    ps1 = runFfmpegProcess(args1, { buffer: false }, { logCli: false });
    ps2 = runFfmpegProcess(args2, undefined, { logCli: false });
    assert(ps1.stdout != null);
    assert(ps2.stdin != null);
    ps1.stdout.pipe(ps2.stdin);

    const timer = setTimeout(() => {
      ps1?.kill();
      ps2?.kill();
      logger.warn('ffmpeg timed out');
    }, 10000);

    let stdout;
    try {
      ({ stdout } = await ps2);
    } finally {
      clearTimeout(timer);
    }

    return {
      buffer: stdout,
    };
  } catch (err) {
    if (ps1) ps1.kill();
    if (ps2) ps2.kill();
    throw err;
  }
}

const getInputSeekArgs = ({ filePath, from, to }: { filePath: string, from?: number | undefined, to?: number | undefined }) => [
  ...(from != null ? ['-ss', from.toFixed(5)] : []),
  '-i', filePath,
  ...(from != null && to != null ? ['-t', (to - from).toFixed(5)] : []),
];

export function mapTimesToSegments(times: number[], includeLast: boolean) {
  const segments: { start: number, end: number | undefined }[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const start = times[i];
    const end = times[i + 1];
    if (start != null) {
      if (end != null) {
        segments.push({ start, end });
      } else if (includeLast) {
        segments.push({ start, end }); // end undefined is allowed (means until end of video)
      }
    }
  }
  return segments;
}

const getSegmentOffset = (from?: number) => (from != null ? from : 0);

function adjustSegmentsWithOffset({ segments, from }: { segments: { start: number, end: number | undefined }[], from?: number | undefined }) {
  const offset = getSegmentOffset(from);
  return segments.map(({ start, end }) => ({ start: start + offset, end: end != null ? end + offset : end }));
}

// https://stackoverflow.com/questions/35675529/using-ffmpeg-how-to-do-a-scene-change-detection-with-timecode
export async function detectSceneChanges({ filePath, minChange, onProgress, from, to }: {
  filePath: string, minChange: number | string, onProgress: (p: number) => void, from: number, to: number,
}) {
  const args = [
    '-hide_banner',
    ...getInputSeekArgs({ filePath, from, to }),
    '-filter_complex', `select='gt(scene,${minChange})',metadata=print:file=-`,
    '-f', 'null', '-',
  ];
  const process = runFfmpegProcess(args, { buffer: false });

  const times = [0];

  handleProgress(process, to - from, onProgress);
  assert(process.stdout != null);
  const rl = readline.createInterface({ input: process.stdout });
  rl.on('line', (line) => {
    // eslint-disable-next-line unicorn/better-regex
    const match = line.match(/^frame:\d+\s+pts:\d+\s+pts_time:([\d.]+)/);
    if (!match) return;
    const time = parseFloat(match[1]!);
    // @ts-expect-error todo
    if (Number.isNaN(time) || time <= times.at(-1)) return;
    times.push(time);
  });

  await process;

  const segments = mapTimesToSegments(times, false);

  return adjustSegmentsWithOffset({ segments, from });
}

async function detectIntervals({ filePath, customArgs, onProgress, from, to, matchLineTokens, boundingMode }: {
  filePath: string, customArgs: string[], onProgress: (p: number) => void, from: number, to: number, matchLineTokens: (line: string) => { start: number, end: number } | undefined, boundingMode: boolean
}) {
  const args = [
    '-hide_banner',
    ...getInputSeekArgs({ filePath, from, to }),
    ...customArgs,
    '-f', 'null', '-',
  ];
  const process = runFfmpegProcess(args, { buffer: false });

  let segments: { start: number, end: number }[] = [];
  const midpoints: number[] = [];

  function customMatcher(line: string) {
    const match = matchLineTokens(line);
    if (match == null) return;
    const { start, end } = match;

    if (boundingMode) {
      segments.push({ start, end });
    } else {
      midpoints.push(start + ((end - start) / 2));
    }
  }
  handleProgress(process, to - from, onProgress, customMatcher);

  await process;

  if (!boundingMode) {
    segments = midpoints.flatMap((time, i) => [
      {
        start: midpoints[i - 1] ?? 0,
        end: time,
      },
    ]);

    const lastMidpoint = midpoints.at(-1);
    if (lastMidpoint != null) {
      segments.push({
        start: lastMidpoint,
        end: to - from,
      });
    }
  }

  return adjustSegmentsWithOffset({ segments, from });
}

const mapFilterOptions = (options: Record<string, string>) => Object.entries(options).map(([key, value]) => `${key}=${value}`).join(':');

export async function blackDetect({ filePath, filterOptions, boundingMode, onProgress, from, to }: {
  filePath: string, filterOptions: Record<string, string>, boundingMode: boolean, onProgress: (p: number) => void, from: number, to: number,
}) {
  return detectIntervals({
    filePath,
    onProgress,
    from,
    to,
    boundingMode,
    matchLineTokens: (line) => {
      // eslint-disable-next-line unicorn/better-regex
      const match = line.match(/^[blackdetect\s*@\s*0x[0-9a-f]+] black_start:([\d\\.]+) black_end:([\d\\.]+) black_duration:[\d\\.]+/);
      if (!match) {
        return undefined;
      }
      const start = parseFloat(match[1]!);
      const end = parseFloat(match[2]!);
      if (Number.isNaN(start) || Number.isNaN(end)) {
        return undefined;
      }
      if (start < 0 || end <= 0 || start >= end) {
        return undefined;
      }
      return { start, end };
    },
    customArgs: ['-vf', `blackdetect=${mapFilterOptions(filterOptions)}`, '-an'],
  });
}

export async function silenceDetect({ filePath, filterOptions, boundingMode, onProgress, from, to }: {
  filePath: string, filterOptions: Record<string, string>, boundingMode: boolean, onProgress: (p: number) => void, from: number, to: number,
}) {
  return detectIntervals({
    filePath,
    onProgress,
    from,
    to,
    boundingMode,
    matchLineTokens: (line) => {
      // eslint-disable-next-line unicorn/better-regex
      const match = line.match(/^[silencedetect\s*@\s*0x[0-9a-f]+] silence_end: ([\d\\.]+)[|\s]+silence_duration: ([\d\\.]+)/);
      if (!match) {
        return undefined;
      }
      const end = parseFloat(match[1]!);
      const silenceDuration = parseFloat(match[2]!);
      if (Number.isNaN(end) || Number.isNaN(silenceDuration)) {
        return undefined;
      }
      const start = end - silenceDuration;
      if (start < 0 || end <= 0 || start >= end) {
        return undefined;
      }
      return { start, end };
    },
    customArgs: ['-af', `silencedetect=${mapFilterOptions(filterOptions)}`, '-vn'],
  });
}

function getFffmpegJpegQuality(quality: number) {
  // Normal range for JPEG is 2-31 with 31 being the worst quality.
  const qMin = 2;
  const qMax = 31;
  return Math.min(Math.max(qMin, quality, Math.round((1 - quality) * (qMax - qMin) + qMin)), qMax);
}

function getQualityOpts({ captureFormat, quality }: { captureFormat: CaptureFormat, quality: number }) {
  if (captureFormat === 'jpeg') return ['-q:v', String(getFffmpegJpegQuality(quality))];
  if (captureFormat === 'webp') return ['-q:v', String(Math.max(0, Math.min(100, Math.round(quality * 100))))];
  return [];
}

function getCodecOpts(captureFormat: CaptureFormat) {
  if (captureFormat === 'webp') return ['-c:v', 'libwebp']; // else we get only a single file for webp https://github.com/mifi/lossless-cut/issues/1693
  return [];
}

export async function captureFrames({ from, to, videoPath, outPathTemplate, quality, filter, framePts, onProgress, captureFormat }: {
  from: number,
  to: number,
  videoPath: string,
  outPathTemplate: string,
  quality: number,
  filter?: string | undefined,
  framePts?: boolean | undefined,
  onProgress: (p: number) => void,
  captureFormat: CaptureFormat,
}) {
  const args = [
    '-ss', String(from),
    '-i', videoPath,
    '-t', String(Math.max(0, to - from)),
    ...getQualityOpts({ captureFormat, quality }),
    ...(filter != null ? ['-vf', filter] : []),
    // https://superuser.com/questions/1336285/use-ffmpeg-for-thumbnail-selections
    ...(framePts ? ['-frame_pts', '1'] : []),
    '-vsync', '0', // else we get a ton of duplicates (thumbnail filter)
    ...getCodecOpts(captureFormat),
    '-f', 'image2',
    '-y', outPathTemplate,
  ];

  const process = runFfmpegProcess(args, { buffer: false });

  handleProgress(process, to - from, onProgress);

  await process;
  return args;
}

export async function captureFrame({ timestamp, videoPath, outPath, quality }: {
  timestamp: number, videoPath: string, outPath: string, quality: number,
}) {
  const ffmpegQuality = getFffmpegJpegQuality(quality);
  const args = [
    '-ss', String(timestamp),
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', String(ffmpegQuality),
    '-y', outPath,
  ];
  await runFfmpegProcess(args);
  return args;
}


async function readFormatData(filePath: string) {
  logger.info('readFormatData', filePath);

  const { stdout } = await runFfprobe([
    '-of', 'json', '-show_format', '-i', filePath, '-hide_banner',
  ]);
  return JSON.parse(stdout as unknown as string).format;
}

export async function getDuration(filePath: string) {
  return parseFloat((await readFormatData(filePath)).duration);
}

export function readOneJpegFrame({ path, seekTo, videoStreamIndex }: { path: string, seekTo: number, videoStreamIndex: number }) {
  const args = [
    '-hide_banner', '-loglevel', 'error',

    '-ss', String(seekTo),

    '-noautorotate',

    '-i', path,

    '-map', `0:${videoStreamIndex}`,
    '-vcodec', 'mjpeg',

    '-frames:v', '1',

    '-f', 'image2pipe',
    '-',
  ];

  // logger.info(getFfCommandLine('ffmpeg', args));
  return runFfmpegProcess(args, undefined, { logCli: false });
}

const enableLog = false;
const encode = true;

export function createMediaSourceProcess({ path, videoStreamIndex, audioStreamIndex, seekTo, size, fps }: {
  path: string, videoStreamIndex?: number | undefined, audioStreamIndex?: number | undefined, seekTo: number, size?: number | undefined, fps?: number | undefined,
}) {
  function getVideoFilters() {
    if (videoStreamIndex == null) return [];

    const filters: string[] = [];
    if (fps != null) filters.push(`fps=${fps}`);
    if (size != null) filters.push(`scale=${size}:${size}:flags=lanczos:force_original_aspect_ratio=decrease`);
    if (filters.length === 0) return [];
    return ['-vf', filters.join(',')];
  }

  // https://stackoverflow.com/questions/16658873/how-to-minimize-the-delay-in-a-live-streaming-with-ffmpeg
  // https://unix.stackexchange.com/questions/25372/turn-off-buffering-in-pipe
  const args = [
    '-hide_banner',
    ...(enableLog ? [] : ['-loglevel', 'error']),

    // https://stackoverflow.com/questions/30868854/flush-latency-issue-with-fragmented-mp4-creation-in-ffmpeg
    '-fflags', '+nobuffer+flush_packets+discardcorrupt',
    '-avioflags', 'direct',
    // '-flags', 'low_delay', // this seems to ironically give a *higher* delay
    '-flush_packets', '1',

    '-vsync', 'passthrough',

    '-ss', String(seekTo),

    '-noautorotate',

    '-i', path,

    ...(videoStreamIndex != null ? ['-map', `0:${videoStreamIndex}`] : ['-vn']),

    ...(audioStreamIndex != null ? ['-map', `0:${audioStreamIndex}`] : ['-an']),

    ...(encode ? [
      ...(videoStreamIndex != null ? [
        ...getVideoFilters(),

        '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '10',
        '-g', '1', // reduces latency and buffering
      ] : []),

      ...(audioStreamIndex != null ? [
        '-ac', '2', '-c:a', 'aac', '-b:a', '128k',
      ] : []),

      // May alternatively use webm/vp8 https://stackoverflow.com/questions/24152810/encoding-ffmpeg-to-mpeg-dash-or-webm-with-keyframe-clusters-for-mediasource
    ] : [
      '-c', 'copy',
    ]),

    '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-',
  ];

  if (enableLog) logger.info(getFfCommandLine('ffmpeg', args));

  return execa(getFfmpegPath(), args, { encoding: null, buffer: false, stderr: enableLog ? 'inherit' : 'pipe' });
}

export async function downloadMediaUrl(url: string, outPath: string) {
  // User agent taken from https://techblog.willshouse.com/2012/01/03/most-common-user-agents/
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const args = [
    '-hide_banner', '-loglevel', 'error',
    '-user_agent', userAgent,
    '-i', url,
    '-c', 'copy',
    outPath,
  ];

  await runFfmpegProcess(args);
}

// Don't pass complex objects over the bridge (process)
export const runFfmpeg = async (...args: Parameters<typeof runFfmpegProcess>) => runFfmpegProcess(...args);
