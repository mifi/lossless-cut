const { join } = require('path');
const isDev = require('electron-is-dev');
const readline = require('readline');
const stringToStream = require('string-to-stream');

const { platform, arch, isWindows, isMac, isLinux } = require('./util');

const execaPromise = import('execa');

let execa;
execaPromise.then((execaNew) => {
  ({ execa } = execaNew);
}).catch((err) => console.error(err));


const runningFfmpegs = new Set();
// setInterval(() => console.log(runningFfmpegs.size), 1000);

let customFfPath;

// Note that this does not work on MAS because of sandbox restrictions
function setCustomFfPath(path) {
  customFfPath = path;
}

function getFfCommandLine(cmd, args) {
  const mapArg = arg => (/[^0-9a-zA-Z-_]/.test(arg) ? `'${arg}'` : arg);
  return `${cmd} ${args.map(mapArg).join(' ')}`;
}

function getFfPath(cmd) {
  const exeName = isWindows ? `${cmd}.exe` : cmd;

  if (customFfPath) return join(customFfPath, exeName);
  if (isDev) return join('ffmpeg', `${platform}-${arch}`, exeName);
  return join(process.resourcesPath, exeName);
}

const getFfprobePath = () => getFfPath('ffprobe');
const getFfmpegPath = () => getFfPath('ffmpeg');

function abortFfmpegs() {
  console.log('Aborting', runningFfmpegs.size, 'ffmpeg process(es)');
  runningFfmpegs.forEach((process) => {
    process.kill('SIGTERM', { forceKillAfterTimeout: 10000 });
  });
}

function handleProgress(process, durationIn, onProgress, customMatcher = () => {}) {
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

      const timeStr = match[1];
      console.log(timeStr);
      const match2 = timeStr.match(/^(\d+):(\d+):(\d+)\.(\d+)$/);

      const h = parseInt(match2[1], 10);
      const m = parseInt(match2[2], 10);
      const s = parseInt(match2[3], 10);
      const cs = parseInt(match2[4], 10);
      const time = (((h * 60) + m) * 60 + s) + cs / 100;
      console.log(time);

      const progressTime = Math.max(0, time);
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

function getExecaOptions({ env, ...customExecaOptions } = {}) {
  const execaOptions = { ...customExecaOptions, env: { ...env } };
  // https://github.com/mifi/lossless-cut/issues/1143#issuecomment-1500883489
  if (isLinux && !isDev && !customFfPath) execaOptions.env.LD_LIBRARY_PATH = process.resourcesPath;
}

// todo collect warnings from ffmpeg output and show them after export? example: https://github.com/mifi/lossless-cut/issues/1469
function runFfmpegProcess(args, customExecaOptions, { logCli = true } = {}) {
  const ffmpegPath = getFfmpegPath();
  if (logCli) console.log(getFfCommandLine('ffmpeg', args));

  const process = execa(ffmpegPath, args, getExecaOptions(customExecaOptions));

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

async function runFfmpegConcat({ ffmpegArgs, concatTxt, totalDuration, onProgress }) {
  const process = runFfmpegProcess(ffmpegArgs);

  handleProgress(process, totalDuration, onProgress);

  stringToStream(concatTxt).pipe(process.stdin);

  return process;
}

async function runFfmpegWithProgress({ ffmpegArgs, duration, onProgress }) {
  const process = runFfmpegProcess(ffmpegArgs);
  handleProgress(process, duration, onProgress);
  return process;
}

async function runFfprobe(args, { timeout = isDev ? 10000 : 30000 } = {}) {
  const ffprobePath = getFfprobePath();
  console.log(getFfCommandLine('ffprobe', args));
  const ps = execa(ffprobePath, args, getExecaOptions());
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

async function renderWaveformPng({ filePath, start, duration, color }) {
  const args1 = [
    '-hide_banner',
    '-i', filePath,
    '-ss', start,
    '-t', duration,
    '-c', 'copy',
    '-vn',
    '-map', 'a:0',
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

  console.log(getFfCommandLine('ffmpeg1', args1));
  console.log('|', getFfCommandLine('ffmpeg2', args2));

  let ps1;
  let ps2;
  try {
    ps1 = runFfmpegProcess(args1, { encoding: null, buffer: false }, { logCli: false });
    ps2 = runFfmpegProcess(args2, { encoding: null }, { logCli: false });
    ps1.stdout.pipe(ps2.stdin);

    const timer = setTimeout(() => {
      ps1.kill();
      ps2.kill();
      console.warn('ffmpeg timed out');
    }, 10000);

    let stdout;
    try {
      ({ stdout } = await ps2);
    } finally {
      clearTimeout(timer);
    }

    return {
      buffer: stdout,
      from: start,
      to: start + duration,
      duration,
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

function mapTimesToSegments(times) {
  const segments = [];
  for (let i = 0; i < times.length; i += 1) {
    const start = times[i];
    const end = times[i + 1];
    if (start != null) segments.push({ start, end }); // end undefined is allowed (means until end of video)
  }
  return segments;
}

const getSegmentOffset = (from) => (from != null ? from : 0);

function adjustSegmentsWithOffset({ segments, from }) {
  const offset = getSegmentOffset(from);
  return segments.map(({ start, end }) => ({ start: start + offset, end: end != null ? end + offset : end }));
}

// https://stackoverflow.com/questions/35675529/using-ffmpeg-how-to-do-a-scene-change-detection-with-timecode
async function detectSceneChanges({ filePath, minChange, onProgress, from, to }) {
  const args = [
    '-hide_banner',
    ...getInputSeekArgs({ filePath, from, to }),
    '-filter_complex', `select='gt(scene,${minChange})',metadata=print:file=-`,
    '-f', 'null', '-',
  ];
  const process = runFfmpegProcess(args, { encoding: null, buffer: false });

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

async function detectIntervals({ filePath, customArgs, onProgress, from, to, matchLineTokens }) {
  const args = [
    '-hide_banner',
    ...getInputSeekArgs({ filePath, from, to }),
    ...customArgs,
    '-f', 'null', '-',
  ];
  const process = runFfmpegProcess(args, { encoding: null, buffer: false });

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

function getFffmpegJpegQuality(quality) {
  // Normal range for JPEG is 2-31 with 31 being the worst quality.
  const qMin = 2;
  const qMax = 31;
  return Math.min(Math.max(qMin, quality, Math.round((1 - quality) * (qMax - qMin) + qMin)), qMax);
}

async function captureFrames({ from, to, videoPath, outPathTemplate, quality, filter, framePts, onProgress }) {
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

  const process = runFfmpegProcess(args, { encoding: null, buffer: false });

  handleProgress(process, to - from, onProgress);

  await process;
}

async function captureFrame({ timestamp, videoPath, outPath, quality }) {
  const ffmpegQuality = getFffmpegJpegQuality(quality);
  await runFfmpegProcess([
    '-ss', timestamp,
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', ffmpegQuality,
    '-y', outPath,
  ]);
}


async function readFormatData(filePath) {
  console.log('readFormatData', filePath);

  const { stdout } = await runFfprobe([
    '-of', 'json', '-show_format', '-i', filePath, '-hide_banner',
  ]);
  return JSON.parse(stdout).format;
}

async function getDuration(filePath) {
  return parseFloat((await readFormatData(filePath)).duration);
}

async function html5ify({ outPath, filePath: filePathArg, speed, hasAudio, hasVideo, onProgress }) {
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
  const process = runFfmpegProcess(ffmpegArgs);
  if (duration) handleProgress(process, duration, onProgress);

  const { stdout } = await process;
  console.log(stdout);
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
    process: runFfmpegProcess(args, execaOpts, { logCli: false }),
    width: newWidth,
    height: newHeight,
    channels: 4,
  };
}

function getOneRawFrame({ path, inWidth, inHeight, seekTo, streamIndex, outSize }) {
  const { process, width, height, channels } = createRawFfmpeg({ path, inWidth, inHeight, seekTo, streamIndex, oneFrameOnly: true, execaOpts: { encoding: null }, outSize });
  return { process, width, height, channels };
}

function encodeLiveRawStream({ path, inWidth, inHeight, seekTo, streamIndex }) {
  const { process, width, height, channels } = createRawFfmpeg({ path, inWidth, inHeight, seekTo, streamIndex, execaOpts: { encoding: null, buffer: false } });

  return {
    process,
    width,
    height,
    channels,
  };
}

// Don't pass complex objects over the bridge
const runFfmpeg = async (...args) => runFfmpegProcess(...args);

module.exports = {
  whenImported: execaPromise,
  setCustomFfPath,
  abortFfmpegs,
  getFfmpegPath,
  runFfprobe,
  runFfmpeg,
  runFfmpegConcat,
  runFfmpegWithProgress,
  renderWaveformPng,
  mapTimesToSegments,
  detectSceneChanges,
  detectIntervals,
  captureFrames,
  captureFrame,
  getFfCommandLine,
  html5ify,
  getDuration,
  getOneRawFrame,
  encodeLiveRawStream,
};
