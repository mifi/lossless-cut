const execa = require('execa');
const bluebird = require('bluebird');
const which = bluebird.promisify(require('which'));
const path = require('path');
const fs = require('fs');
const fileType = require('file-type');
const readChunk = require('read-chunk');
const _ = require('lodash');

const util = require('./util');

bluebird.promisifyAll(fs);


function showFfmpegFail(err) {
  alert(`Failed to run ffmpeg:\n${err.stack}`);
  console.error(err.stack);
}

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

function cut(filePath, format, cutFrom, cutTo) {
  return bluebird.try(() => {
    const ext = path.extname(filePath) || format;
    const outFileAppend = `${util.formatDuration(cutFrom)}-${util.formatDuration(cutTo)}`;
    const outFile = `${filePath}-${outFileAppend}.${ext}`;

    console.log('Cutting from', cutFrom, 'to', cutTo);

    const ffmpegArgs = [
      '-ss', cutFrom,
      '-i', filePath, '-y', '-vcodec', 'copy', '-acodec', 'copy',
      '-to', cutTo,
      '-f', format,
      outFile,
    ];

    console.log('ffmpeg', ffmpegArgs.join(' '));

    return getFfmpegPath()
      .then(ffmpegPath => execa(ffmpegPath, ffmpegArgs))
      .then((result) => {
        console.log(result.stdout);
      });
  });
}

function getFormat(filePath) {
  return bluebird.try(() => {
    console.log('getFormat', filePath);

    return getFfmpegPath()
      .then(ffmpegPath => path.join(path.dirname(ffmpegPath), getWithExt('ffprobe')))
      .then(ffprobePath => execa(ffprobePath, [
        '-of', 'json', '-show_format', '-i', filePath,
      ]))
      .then((result) => {
        const formatsStr = JSON.parse(result.stdout).format.format_name;
        console.log('formats', formatsStr);
        const formats = (formatsStr || '').split(',');

        // ffprobe sometimes returns a list of formats, try to be a bit smarter about it.
        return readChunk(filePath, 0, 262)
          .then((bytes) => {
            const ft = fileType(bytes);
            if (_.includes(formats, (ft || {}).ext)) return ft.ext;
            return formats[0] || undefined;
          });
      });
  });
}

module.exports = {
  cut,
  getFormat,
  showFfmpegFail,
};
