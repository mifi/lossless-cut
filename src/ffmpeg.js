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

function cut(customOutDir, filePath, format, cutFrom, cutTo) {
  return bluebird.try(() => {
    const extWithoutDot = path.extname(filePath) || `.${format}`;
    const ext = `.${extWithoutDot}`;
    const duration = `${util.formatDuration(cutFrom)}-${util.formatDuration(cutTo)}`;

    const outPath = util.getOutPath(customOutDir, filePath, `${duration}${ext}`);

    console.log('Cutting from', cutFrom, 'to', cutTo);

    const ffmpegArgs = [
      '-i', filePath, '-y', '-vcodec', 'copy', '-acodec', 'copy',
      '-ss', cutFrom, '-t', cutTo - cutFrom,
      '-f', format,
      outPath,
    ];

    console.log('ffmpeg', ffmpegArgs.join(' '));

    return getFfmpegPath()
      .then(ffmpegPath => execa(ffmpegPath, ffmpegArgs))
      .then((result) => {
        console.log(result.stdout);
      });
  });
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
  if (_.includes(ffprobeFormats, ft.ext)) return ft.ext;
  return ffprobeFormats[0] || undefined;
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
        return readChunk(filePath, 0, 4100)
          .then((bytes) => {
            const ft = fileType(bytes) || {};
            console.log(`fileType detected format ${JSON.stringify(ft)}`);
            const assumedFormat = determineOutputFormat(formats, ft);
            return mapFormat(assumedFormat);
          });
      });
  });
}

module.exports = {
  cut,
  getFormat,
  showFfmpegFail,
};
