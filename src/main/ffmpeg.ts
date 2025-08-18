import { join } from 'node:path';
import readline from 'node:readline';
import stringToStream from 'string-to-stream';
import { execa, Options as ExecaOptions, ResultPromise } from 'execa';
import assert from 'node:assert';
import { Readable } from 'node:stream';
// eslint-disable-next-line import/no-extraneous-dependencies
import { app } from 'electron';

import { platform, arch, isWindows, isLinux } from './util.js';
import { CaptureFormat, Waveform } from '../../types.js';
import isDev from './isDev.js';
import logger from './logger.js';
import { parseFfmpegProgressLine } from './progress.js';

// cannot use process.kill: https://github.com/sindresorhus/execa/issues/1177
const runningFfmpegs = new Set<{
  process: ResultPromise<Omit<ExecaOptions, 'encoding'> & { encoding: 'buffer' }>,
  abortController: AbortController,
}>();
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
    process.abortController.abort();
  });
}

// Optimized progress handling with better performance and reduced overhead
function handleProgress(
  process: { stderr: Readable | null },
  duration: number | undefined,
  onProgress: (a: number) => void,
  customMatcher?: (a: string) => void,
) {
  if (!onProgress) return;
  if (process.stderr == null) return;
  onProgress(0);

  // Performance optimization: Create readline interface with optimized settings
  const rl = readline.createInterface({ 
    input: process.stderr,
    // Optimize for performance
    crlfDelay: Infinity,
    historySize: 0, // Disable history to save memory
  });

  // Throttle progress updates to reduce UI overhead
  let lastProgressTime = 0;
  const progressThrottle = 50; // Update progress max every 50ms
  let lastProgress = 0;

  rl.on('line', (line) => {
    // console.log('progress', line);

    try {
      const now = Date.now();
      
      // Skip processing if too frequent (performance optimization)
      if (now - lastProgressTime < progressThrottle) return;

      const progress = parseFfmpegProgressLine({ line, customMatcher, duration });
      if (progress != null && Math.abs(progress - lastProgress) > 0.001) { // Only update if progress changed significantly
        onProgress(progress);
        lastProgressTime = now;
        lastProgress = progress;
      }
    } catch (err) {
      // Reduce logging overhead - only log in debug mode
      if (logger.level === 'debug') {
        logger.error('Failed to parse ffmpeg progress line:', err instanceof Error ? err.message : err);
      }
    }
  });
}

function getExecaOptions({ env, cancelSignal, ...rest }: ExecaOptions = {}) {
  // This is a ugly hack to please execa which expects cancelSignal to be a prototype of AbortSignal
  // however this gets lost during @electron/remote passing
  // https://github.com/sindresorhus/execa/blob/c8cff27a47b6e6f1cfbfec2bf7fa9dcd08cefed1/lib/terminate/cancel.js#L5
  if (cancelSignal != null) Object.setPrototypeOf(cancelSignal, new AbortController().signal);

  const execaOptions: Pick<ExecaOptions, 'env'> & { encoding: 'buffer' } = {
    ...(cancelSignal != null && { cancelSignal }),
    ...rest,
    encoding: 'buffer' as const,
    env: {
      ...env,
      // https://github.com/mifi/lossless-cut/issues/1143#issuecomment-1500883489
      ...(isLinux && !isDev && !customFfPath && { LD_LIBRARY_PATH: process.resourcesPath }),
    },
  };
  return execaOptions;
}

// Optimized FFmpeg process runner with performance improvements
function runFfmpegProcess(args: readonly string[], customExecaOptions?: ExecaOptions, additionalOptions?: { logCli?: boolean }) {
  const ffmpegPath = getFfmpegPath();
  const { logCli = true } = additionalOptions ?? {};
  if (logCli) logger.info(getFfCommandLine('ffmpeg', args));

  // Performance optimization: Add performance-focused arguments
  const optimizedArgs = [
    '-threads', '0', // Use all available CPU cores
    '-fflags', '+discardcorrupt+genpts', // Improve error handling and timestamp generation
    '-avioflags', 'direct', // Reduce I/O overhead
    ...args
  ];

  const abortController = new AbortController();
  
  // Optimize process creation options
  const optimizedExecaOptions = {
    ...getExecaOptions({ 
      ...customExecaOptions, 
      cancelSignal: abortController.signal,
      // Performance optimizations
      windowsHide: true,
      cleanup: true,
      maxBuffer: 1024 * 1024 * 64, // 64MB buffer
    }),
  };

  const process = execa(ffmpegPath, optimizedArgs, optimizedExecaOptions);

  const wrapped = { process, abortController };

  (async () => {
    runningFfmpegs.add(wrapped);
    try {
      await process;
    } catch {
      // ignored here
    } finally {
      runningFfmpegs.delete(wrapped);
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

export async function renderWaveformPng({ filePath, start, duration, resample, color, streamIndex, timeout }: {
  filePath: string,
  start?: number,
  duration?: number,
  resample?: number,
  color: string,
  streamIndex: number,
  timeout?: number,
}): Promise<Waveform> {
  const args1 = [
    '-hide_banner',
    '-i', filePath,
    '-vn',
    '-map', `0:${streamIndex}`,
    ...(start != null ? ['-ss', String(start)] : []),
    ...(duration != null ? ['-t', String(duration)] : []),
    ...(resample != null ? [
      // the operation is faster if we resample
      // the higher the resample rate, the faster the resample
      // but the slower the showwavespic operation will be...
      // https://github.com/mifi/lossless-cut/issues/260#issuecomment-605603456
      '-c:a', 'pcm_s32le',
      '-ar', String(resample),
    ] : [
      '-c', 'copy',
    ]),
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

  logger.info(`${getFfCommandLine('ffmpeg', args1)} | \n${getFfCommandLine('ffmpeg', args2)}`);

  let ps1: ResultPromise<{ encoding: 'buffer' }> | undefined;
  let ps2: ResultPromise<{ encoding: 'buffer' }> | undefined;
  try {
    ps1 = runFfmpegProcess(args1, { buffer: false, ...(timeout != null && { timeout }) }, { logCli: false });
    ps2 = runFfmpegProcess(args2, timeout != null ? { timeout } : undefined, { logCli: false });
    assert(ps1.stdout != null);
    assert(ps2.stdin != null);
    ps1.stdout.pipe(ps2.stdin);

    const { stdout } = await ps2;

    return {
      buffer: Buffer.from(stdout),
    };
  } catch (err) {
    ps1?.kill();
    ps2?.kill();
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

interface DetectedSegment {
  start: number,
  end: number,
}

// https://stackoverflow.com/questions/35675529/using-ffmpeg-how-to-do-a-scene-change-detection-with-timecode
export async function detectSceneChanges({ filePath, streamId, minChange, onProgress, onSegmentDetected, from, to }: {
  filePath: string,
  streamId: number | undefined
  minChange: number | string,
  onProgress: (p: number) => void,
  onSegmentDetected: (p: DetectedSegment) => void,
  from: number,
  to: number,
}) {
  const args = [
    '-hide_banner',
    ...getInputSeekArgs({ filePath, from, to }),
    '-map', streamId != null ? `0:${streamId}` : 'v:0',
    '-filter:v', `select='gt(scene,${minChange})',metadata=print:file=-:direct=1`, // direct=1 to flush stdout immediately
    '-f', 'null', '-',
  ];
  const process = runFfmpegProcess(args, { buffer: false });

  handleProgress(process, to - from, onProgress);

  assert(process.stdout != null);
  const rl = readline.createInterface({ input: process.stdout });

  let lastTime: number | undefined;

  rl.on('line', (line) => {
    // eslint-disable-next-line unicorn/better-regex
    const match = line.match(/^frame:\d+\s+pts:\d+\s+pts_time:([\d.]+)/);
    if (!match) return;
    const time = parseFloat(match[1]!);
    if (!Number.isNaN(time)) {
      if (lastTime != null && time > lastTime) {
        onSegmentDetected({ start: from + lastTime, end: from + time });
      }
      lastTime = time;
    }
  });

  await process;

  return { ffmpegArgs: args };
}

async function detectIntervals({ filePath, customArgs, onProgress, onSegmentDetected, from, to, matchLineTokens, boundingMode }: {
  filePath: string,
  customArgs: string[],
  onProgress: (p: number) => void,
  onSegmentDetected: (p: DetectedSegment) => void,
  from: number,
  to: number,
  matchLineTokens: (line: string) => DetectedSegment | undefined,
  boundingMode: boolean,
}) {
  const args = [
    '-hide_banner',
    ...getInputSeekArgs({ filePath, from, to }),
    ...customArgs,
    '-f', 'null', '-',
  ];
  const process = runFfmpegProcess(args, { buffer: false });

  let lastMidpoint: number | undefined;

  function customMatcher(line: string) {
    const match = matchLineTokens(line);
    if (match == null) return;
    const { start, end } = match;

    if (boundingMode) {
      onSegmentDetected({ start: from + start, end: from + end });
    } else {
      const midpoint = start + ((end - start) / 2);

      onSegmentDetected({ start: from + (lastMidpoint ?? 0), end: from + midpoint });
      lastMidpoint = midpoint;
    }
  }

  handleProgress(process, to - from, onProgress, customMatcher);

  await process;

  if (!boundingMode && lastMidpoint != null) {
    onSegmentDetected({
      start: from + lastMidpoint,
      end: to,
    });
  }

  return { ffmpegArgs: args };
}

const mapFilterOptions = (options: Record<string, string>) => Object.entries(options).map(([key, value]) => `${key}=${value}`).join(':');

export async function blackDetect({ filePath, streamId, filterOptions, boundingMode, onProgress, onSegmentDetected, from, to }: {
  filePath: string,
  streamId: number | undefined,
  filterOptions: Record<string, string>,
  boundingMode: boolean,
  onProgress: (p: number) => void,
  onSegmentDetected: (p: DetectedSegment) => void,
  from: number,
  to: number,
}) {
  return detectIntervals({
    filePath,
    onProgress,
    onSegmentDetected,
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
    customArgs: [
      '-map', streamId != null ? `0:${streamId}` : 'v:0',
      '-filter:v', `blackdetect=${mapFilterOptions(filterOptions)}`,
    ],
  });
}

export async function silenceDetect({ filePath, streamId, filterOptions, boundingMode, onProgress, onSegmentDetected, from, to }: {
  filePath: string,
  streamId: number | undefined,
  filterOptions: Record<string, string>,
  boundingMode: boolean,
  onProgress: (p: number) => void,
  onSegmentDetected: (p: DetectedSegment) => void,
  from: number, to: number,
}) {
  return detectIntervals({
    filePath,
    onProgress,
    onSegmentDetected,
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
    customArgs: [
      '-map', streamId != null ? `0:${streamId}` : 'a:0',
      '-filter:a', `silencedetect=${mapFilterOptions(filterOptions)}`,
    ],
  });
}

function getFfmpegJpegQuality(quality: number) {
  // Normal range for JPEG is 2-31 with 31 being the worst quality.
  const qMin = 2;
  const qMax = 31;
  return Math.min(Math.max(qMin, quality, Math.round((1 - quality) * (qMax - qMin) + qMin)), qMax);
}

function getQualityOpts({ captureFormat, quality }: { captureFormat: CaptureFormat, quality: number }) {
  if (captureFormat === 'jpeg') return ['-q:v', String(getFfmpegJpegQuality(quality))];
  if (captureFormat === 'webp') return ['-q:v', String(Math.max(0, Math.min(100, Math.round(quality * 100))))];
  return [];
}

function getCodecOpts(captureFormat: CaptureFormat) {
  if (captureFormat === 'webp') return ['-c:v', 'libwebp']; // else we get only a single file for webp https://github.com/mifi/lossless-cut/issues/1693
  return [];
}

export async function captureFrames({ from, to, videoPath, outPathTemplate, quality, filter, framePts, onProgress, captureFormat }: {
  from: number,
  to?: number | undefined,
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
    ...(to != null ? ['-t', String(Math.max(0, to - from))] : []),
    ...getQualityOpts({ captureFormat, quality }),
    // only apply filter for non-markers
    ...(to == null
      ? [
        '-frames:v', '1', // for markers, just capture 1 frame
      ] : (
        // for segments (non markers), apply filter (but only if there is one)
        filter != null ? [
          '-vf', filter,
          // https://superuser.com/questions/1336285/use-ffmpeg-for-thumbnail-selections
          ...(framePts ? ['-frame_pts', '1'] : []),
          '-vsync', '0', // else we get a ton of duplicates (thumbnail filter)
        ] : [])
    ),
    ...getCodecOpts(captureFormat),
    '-f', 'image2',
    '-y', outPathTemplate,
  ];

  const process = runFfmpegProcess(args, { buffer: false });

  if (to != null) {
    handleProgress(process, to - from, onProgress);
  }

  await process;

  onProgress(1);

  return args;
}

export async function captureFrame({ timestamp, videoPath, outPath, quality }: {
  timestamp: number, videoPath: string, outPath: string, quality: number,
}) {
  const ffmpegQuality = getFfmpegJpegQuality(quality);
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
  return JSON.parse(new TextDecoder().decode(stdout)).format;
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

export function createMediaSourceProcess({ path, videoStreamIndex, audioStreamIndexes, seekTo, size, fps }: {
  path: string,
  videoStreamIndex?: number | undefined,
  audioStreamIndexes: number[],
  seekTo: number,
  size?: number | undefined,
  fps?: number | undefined,
}) {
  function getFilters() {
    const graph: string[] = [];

    if (videoStreamIndex != null) {
      const videoFilters: string[] = [];
      if (fps != null) videoFilters.push(`fps=${fps}`);
      if (size != null) videoFilters.push(`scale=${size}:${size}:flags=lanczos:force_original_aspect_ratio=decrease:force_divisible_by=2`);
      const videoFiltersStr = videoFilters.length > 0 ? videoFilters.join(',') : 'null';
      graph.push(`[0:${videoStreamIndex}]${videoFiltersStr}[video]`);
    }

    if (audioStreamIndexes.length > 0) {
      if (audioStreamIndexes.length > 1) {
        const resampledStr = audioStreamIndexes.map((i) => `[resampled${i}]`).join('');
        const weightsStr = audioStreamIndexes.map(() => '1').join(' ');
        graph.push(
          // First resample because else we get the lowest sample rate
          ...audioStreamIndexes.map((i) => `[0:${i}]aresample=44100[resampled${i}]`),
          // now mix all audio channels together
          `${resampledStr}amix=inputs=${audioStreamIndexes.length}:duration=longest:weights=${weightsStr}:normalize=0:dropout_transition=2[audio]`,
        );
      } else {
        graph.push(`[0:${audioStreamIndexes[0]}]anull[audio]`);
      }
    }

    if (graph.length === 0) return [];
    return ['-filter_complex', graph.join(';')];
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

    '-ss', String(seekTo),

    '-noautorotate',

    '-i', path,

    '-fps_mode', 'passthrough',

    ...(encode ? [
      ...getFilters(),

      ...(videoStreamIndex != null ? [
        '-map', '[video]',
        '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '10',
        '-g', '1', // reduces latency and buffering
      ] : ['-vn']),

      ...(audioStreamIndexes.length > 0 ? [
        '-map', '[audio]',
        '-ac', '2', '-c:a', 'aac', '-b:a', '128k',
      ] : ['-an']),

      // May alternatively use webm/vp8 https://stackoverflow.com/questions/24152810/encoding-ffmpeg-to-mpeg-dash-or-webm-with-keyframe-clusters-for-mediasource
    ] : [
      '-c', 'copy',
    ]),

    '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-',
  ];

  if (enableLog) logger.info(getFfCommandLine('ffmpeg', args));

  return execa(getFfmpegPath(), args, { encoding: 'buffer', buffer: false, stderr: enableLog ? 'inherit' : 'pipe' });
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
