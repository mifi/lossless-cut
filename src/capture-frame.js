const bluebird = require('bluebird');
const fs = require('fs');
const mime = require('mime-types');
const strongDataUri = require('strong-data-uri');

bluebird.promisifyAll(fs);

function getFrameFromVideo(video) {
  const format = 'jpeg';

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext('2d').drawImage(video, 0, 0);

  const dataUri = canvas.toDataURL(`image/${format}`);

  return strongDataUri.decode(dataUri);
}

function captureFrame(video, outPathWithoutExt) {
  const buf = getFrameFromVideo(video);
  const ext = mime.extension(buf.mimetype);
  const outPath = `${outPathWithoutExt}.${ext}`;
  return fs.writeFileAsync(outPath, buf);
}

module.exports = captureFrame;
