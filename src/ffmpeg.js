const execa = require('execa');
const bluebird = require('bluebird');
const which = bluebird.promisify(require('which'));
const path = require('path');
const util = require('./util');

const Configstore = require('configstore');

const configstore = new Configstore('lossless-cut', { ffmpegPath: '' });


function showFfmpegFail(err) {
  alert('Failed to run ffmpeg, make sure you have it installed and in available in your PATH or set its path (from the file menu)');
  console.error(err.stack);
}

function getFfmpegPath() {
  return which('ffmpeg')
    .catch(() => configstore.get('ffmpegPath'));
}

function cut(filePath, format, cutFrom, cutTo) {
  const ext = path.extname(filePath) || format;
  const outFileAppend = `${util.formatDuration(cutFrom)}-${util.formatDuration(cutTo)}`;
  const outFile = `${filePath}-${outFileAppend}.${ext}`;

  console.log('Cutting from', cutFrom, 'to', cutTo);

  const ffmpegArgs = [
    '-i', filePath, '-y', '-vcodec', 'copy', '-acodec', 'copy',
    '-ss', cutFrom, '-t', cutTo - cutFrom,
    '-f', format,
    outFile,
  ];

  console.log('ffmpeg', ffmpegArgs.join(' '));

  return getFfmpegPath()
    .then(ffmpegPath => execa(ffmpegPath, ffmpegArgs))
    .then((result) => {
      console.log(result.stdout);
    })
    .catch((err) => {
      if (err.code === 1) {
        alert('Whoops! ffmpeg was unable to cut this video. It may be of an unknown format or codec combination');
        return;
      }
      showFfmpegFail(err);
    });
}

function getFormats(filePath) {
  console.log('getFormat', filePath);

  return getFfmpegPath()
    .then(ffmpegPath => path.join(path.dirname(ffmpegPath), 'ffprobe'))
    .then(ffprobePath => execa(ffprobePath, [
      '-of', 'json', '-show_format', '-i', filePath,
    ]))
    .then((result) => {
      const formatsStr = JSON.parse(result.stdout).format.format_name;
      console.log('formats', formatsStr);
      const formats = formatsStr.split(',');
      return formats;
    });
}

// '-of', 'json', '-select_streams', 'v', '-show_frames', filePath,

module.exports = {
  cut,
  getFormats,
  showFfmpegFail,
};
