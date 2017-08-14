const bluebird = require('bluebird');
const fs = require('fs');
const mime = require('mime-types');
const strongDataUri = require('strong-data-uri');

const util = require('./util');

bluebird.promisifyAll(fs);

function getFrameFromVideo(video, format) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext('2d').drawImage(video, 0, 0);

  const dataUri = canvas.toDataURL(`image/${format}`);

  return strongDataUri.decode(dataUri);
}

function captureFrame(customOutDir, filePath, video, currentTime, captureFormat) {
  const buf = getFrameFromVideo(video, captureFormat);

  const ext = mime.extension(buf.mimetype);
  const time = util.formatDuration(currentTime);

  const outPath = util.getOutPath(customOutDir, filePath, `${time}.${ext}`);
  return fs.writeFileAsync(outPath, buf);
}

module.exports = captureFrame;
