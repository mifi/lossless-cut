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

function getFfprobePath() {
  return getFfmpegPath()
    .then(ffmpegPath => path.join(path.dirname(ffmpegPath), getWithExt('ffprobe')));
}

function getNearestKeyframeTime(filePath, cutTime) {
  return getFfprobePath()
    .then(ffprobePath => execa(ffprobePath, [
      '-of', 'json', '-select_streams', 'v', '-show_frames', '-read_intervals', `${cutTime}%+#1`, '-i', filePath,
    ]))
    .then((result) => {
      // We are gived one frame, which is an I-frame
      const frame = (JSON.parse(result.stdout).frames[0] || {});
      console.log('Frame', frame);
      if (frame.pict_type !== 'I') throw new Error(`Expected I-frame from ffprobe, got ${frame.pict_type}`);
      const safetyOffset = frame.pkt_duration_time * 3; // 3 seems to be working
      const keyframeTime = frame.best_effort_timestamp_time - safetyOffset;
      const keykeyframeTimeTruncated = keyframeTime >= 0 ? keyframeTime : 0;
      console.log('Keyframe time', keykeyframeTimeTruncated);

      return keykeyframeTimeTruncated;
    })
    .catch((err) => {
      console.error('Failed to get nearest keyframe time', err);
      return cutTime;
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

    return getNearestKeyframeTime(filePath, cutFrom)
      .then((cutFromKeyframe) => {
        const ffmpegArgs = [].concat(
          [
            '-i', filePath, '-y', '-vcodec', 'copy', '-acodec', 'copy',
          ],
          cutFromKeyframe ? [
            '-ss', cutFromKeyframe,
          ] : [],
          [
            '-t', cutTo - cutFromKeyframe,
            '-f', format,
            outFile,
          ]
        );

        console.log('ffmpeg', ffmpegArgs.join(' '));

        return getFfmpegPath()
          .then(ffmpegPath => execa(ffmpegPath, ffmpegArgs))
          .then((result) => {
            console.log(result.stdout);
          });
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

    return getFfprobePath()
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
