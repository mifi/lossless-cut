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

function cut(outputDir, filePath, format, cutFrom, cutTo) {
  return bluebird.try(() => {
    const ext = path.extname(filePath) || `.${format}`;
    const duration = `${util.formatDuration(cutFrom)}-${util.formatDuration(cutTo)}`;
    const basename = path.basename(filePath);
    const outFile = outputDir ?
      path.join(outputDir, `${basename}-${duration}${ext}`) :
      `${filePath}-${duration}${ext}`;

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
        const resultAsJSON = JSON.parse(result.stdout);
        const formatsStr = resultAsJSON.format.format_name;
        console.log('formats', formatsStr);
        const formats = (formatsStr || '').split(',');

        // Get duration of media using info from ffprobe
        const mediaDuration = resultAsJSON.format.duration;
        console.log(`length of clip: ${mediaDuration}`);

        // ffprobe sometimes returns a list of formats, try to be a bit smarter about it.
        return readChunk(filePath, 0, 4100)
          .then((bytes) => {
            const ft = fileType(bytes);
            if (_.includes(formats, (ft || {}).ext)) {
              // return an object that will help set values for defaultState
              return {
                fileFormat: ft.ext,
                cutEndTime: mediaDuration
              };
            }

            // return an object that will help set values for defaultState
            return {
              fileFormat: formats[0] || undefined,
              cutEndTime: mediaDuration
            }
          });
      });
  });
}

module.exports = {
  cut,
  getFormat,
  showFfmpegFail,
};
