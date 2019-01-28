const execa = require('execa');
const bluebird = require('bluebird');
const which = bluebird.promisify(require('which'));
const path = require('path');
const fileType = require('file-type');
const readChunk = require('read-chunk');
const flatMap = require('lodash/flatMap');
const readline = require('readline');
const moment = require('moment');
const stringToStream = require('string-to-stream');

const { formatDuration, getOutPath, transferTimestamps } = require('./util');

function getWithExt(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function canExecuteFfmpeg(ffmpegPath) {
  return execa(ffmpegPath, ['-version']);
}

function getFfmpegPath() {
  const internalFfmpeg = path.join(__dirname, '..', 'app.asar.unpacked', 'ffmpeg', getWithExt('ffmpeg'));
  return canExecuteFfmpeg(internalFfmpeg)
    .then(() => internalFfmpeg)
    .catch(() => {
      console.log('Internal ffmpeg unavail');
      return which('ffmpeg');
    });
}

async function getFFprobePath() {
  const ffmpegPath = await getFfmpegPath();
  return path.join(path.dirname(ffmpegPath), getWithExt('ffprobe'));
}

function handleProgress(process, cutDuration, onProgress) {
  const rl = readline.createInterface({ input: process.stderr });
  rl.on('line', (line) => {
    try {
      const match = line.match(/frame=\s*[^\s]+\s+fps=\s*[^\s]+\s+q=\s*[^\s]+\s+(?:size|Lsize)=\s*[^\s]+\s+time=\s*([^\s]+)\s+/); // eslint-disable-line max-len
      if (!match) return;

      const str = match[1];
      console.log(str);
      const progressTime = moment.duration(str).asSeconds();
      console.log(progressTime);
      onProgress(progressTime / cutDuration);
    } catch (err) {
      console.log('Failed to parse ffmpeg progress line', err);
    }
  });
}

async function cut({
  customOutDir, filePath, format, cutFrom, cutTo, cutToApparent, videoDuration, rotation,
  includeAllStreams, onProgress, stripAudio, keyframeCut,
}) {
  const ext = path.extname(filePath) || `.${format}`;
  const cutSpecification = `${formatDuration(cutFrom, true)}-${formatDuration(cutToApparent, true)}`;

  const outPath = getOutPath(customOutDir, filePath, `${cutSpecification}${ext}`);

  console.log('Cutting from', cutFrom, 'to', cutToApparent);

  const cutDuration = cutToApparent - cutFrom;

  // https://github.com/mifi/lossless-cut/issues/50
  const cutFromArgs = cutFrom === 0 ? [] : ['-ss', cutFrom];
  const cutToArgs = cutTo === undefined || cutTo === videoDuration ? [] : ['-t', cutDuration];

  const inputCutArgs = keyframeCut ? [
    ...cutFromArgs,
    '-i', filePath,
    ...cutToArgs,
    '-avoid_negative_ts', 'make_zero',
  ] : [
    '-i', filePath,
    ...cutFromArgs,
    ...cutToArgs,
  ];

  const rotationArgs = rotation !== undefined ? ['-metadata:s:v:0', `rotate=${rotation}`] : [];
  const ffmpegArgs = [
    ...inputCutArgs,

    ...(stripAudio ? ['-an'] : ['-acodec', 'copy']),

    '-vcodec', 'copy',
    '-scodec', 'copy',

    ...(includeAllStreams ? ['-map', '0'] : []),
    '-map_metadata', '0',

    ...rotationArgs,

    '-f', format, '-y', outPath,
  ];

  console.log('ffmpeg', ffmpegArgs.join(' '));

  onProgress(0);

  const ffmpegPath = await getFfmpegPath();
  const process = execa(ffmpegPath, ffmpegArgs);
  handleProgress(process, cutDuration, onProgress);
  const result = await process;
  console.log(result.stdout);

  await transferTimestamps(filePath, outPath);
}

async function html5ify(filePath, outPath, encodeVideo) {
  console.log('Making HTML5 friendly version', { filePath, outPath, encodeVideo });

  const videoArgs = encodeVideo
    ? ['-vf', 'scale=-2:400,format=yuv420p', '-sws_flags', 'neighbor', '-vcodec', 'libx264', '-profile:v', 'baseline', '-x264opts', 'level=3.0', '-preset:v', 'ultrafast', '-crf', '28']
    : ['-vcodec', 'copy'];

  const ffmpegArgs = [
    '-i', filePath, ...videoArgs, '-an',
    '-y', outPath,
  ];

  console.log('ffmpeg', ffmpegArgs.join(' '));

  const ffmpegPath = await getFfmpegPath();
  const process = execa(ffmpegPath, ffmpegArgs);
  const result = await process;
  console.log(result.stdout);

  await transferTimestamps(filePath, outPath);
}

async function mergeFiles(paths) {
  const firstPath = paths[0];
  const ext = path.extname(firstPath);
  const outPath = `${firstPath}-merged${ext}`;
  console.log('Merging files', { paths }, 'to', outPath);

  // https://blog.yo1.dog/fix-for-ffmpeg-protocol-not-on-whitelist-error-for-urls/
  const ffmpegArgs = [
    '-f', 'concat', '-safe', '0', '-protocol_whitelist', 'file,pipe', '-i', '-',
    '-c', 'copy',
    '-map_metadata', '0',
    '-y', outPath,
  ];

  console.log('ffmpeg', ffmpegArgs.join(' '));

  // https://superuser.com/questions/787064/filename-quoting-in-ffmpeg-concat
  const concatTxt = paths.map(file => `file '${path.join(file).replace(/'/g, "'\\''")}'`).join('\n');

  console.log(concatTxt);

  const ffmpegPath = await getFfmpegPath();
  const process = execa(ffmpegPath, ffmpegArgs);

  stringToStream(concatTxt).pipe(process.stdin);

  const result = await process;
  console.log(result.stdout);
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

async function getFormat(filePath) {
  console.log('getFormat', filePath);

  const ffprobePath = await getFFprobePath();
  const result = await execa(ffprobePath, [
    '-of', 'json', '-show_format', '-i', filePath,
  ]);
  const formatsStr = JSON.parse(result.stdout).format.format_name;
  console.log('formats', formatsStr);
  const formats = (formatsStr || '').split(',');

  // ffprobe sometimes returns a list of formats, try to be a bit smarter about it.
  const bytes = await readChunk(filePath, 0, 4100);
  const ft = fileType(bytes) || {};
  console.log(`fileType detected format ${JSON.stringify(ft)}`);
  const assumedFormat = determineOutputFormat(formats, ft);
  return mapFormat(assumedFormat);
}

async function getAllStreams(filePath) {
  const ffprobePath = await getFFprobePath();
  const result = await execa(ffprobePath, [
    '-of', 'json', '-show_entries', 'stream', '-i', filePath,
  ]);

  return JSON.parse(result.stdout);
}

// https://stackoverflow.com/questions/32922226/extract-every-audio-and-subtitles-from-a-video-with-ffmpeg
async function extractAllStreams(filePath) {
  const { streams } = await getAllStreams(filePath);
  console.log('streams', streams);

  function mapCodecToOutputFormat(codec, type) {
    const map = {
      // See mapFormat
      m4a: { ext: 'm4a', format: 'ipod' },
      aac: { ext: 'm4a', format: 'ipod' },

      mp3: { ext: 'mp3', format: 'mp3' },
      opus: { ext: 'opus', format: 'opus' },
      vorbis: { ext: 'ogg', format: 'ogg' },
      h264: { ext: 'mp4', format: 'mp4' },
      eac3: { ext: 'eac3', format: 'eac3' },

      subrip: { ext: 'srt', format: 'srt' },

      // TODO add more
      // TODO allow user to change?
    };

    if (map[codec]) return map[codec];
    if (type === 'video') return { ext: 'mkv', format: 'mkv' };
    if (type === 'audio') return { ext: 'mkv', format: 'mkv' };
    return undefined;
  }

  const outStreams = streams.map((s, i) => ({
    i,
    codec: s.codec_name,
    type: s.codec_type,
    format: mapCodecToOutputFormat(s.codec_name, s.codec_type),
  }))
    .filter(it => it);

  // console.log(outStreams);

  const streamArgs = flatMap(outStreams, ({
    i, codec, type, format: { format, ext },
  }) => [
    '-map', `0:${i}`, '-c', 'copy', '-f', format, '-y', `${filePath}-${i}-${type}-${codec}.${ext}`,
  ]);

  const ffmpegArgs = [
    '-i', filePath,
    ...streamArgs,
  ];

  console.log(ffmpegArgs);

  // TODO progress
  const ffmpegPath = await getFfmpegPath();
  const process = execa(ffmpegPath, ffmpegArgs);
  const result = await process;
  console.log(result.stdout);
}

module.exports = {
  cut,
  getFormat,
  html5ify,
  mergeFiles,
  extractAllStreams,
};
