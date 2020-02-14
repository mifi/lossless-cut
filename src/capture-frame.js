const bluebird = require('bluebird');
const fs = require('fs');
const mime = require('mime-types');
const strongDataUri = require('strong-data-uri');

const { formatDuration, getOutPath, transferTimestampsWithOffset } = require('./util');

bluebird.promisifyAll(fs);

function getFrameFromVideo(video, format) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext('2d').drawImage(video, 0, 0);

  const dataUri = canvas.toDataURL(`image/${format}`);

  return strongDataUri.decode(dataUri);
}

async function captureFrame(customOutDir, filePath, video, currentTime, captureFormat) {
  const buf = getFrameFromVideo(video, captureFormat);

  const ext = mime.extension(buf.mimetype);
  const time = formatDuration({ seconds: currentTime, fileNameFriendly: true });

  const outPath = getOutPath(customOutDir, filePath, `${time}.${ext}`);
  await fs.writeFileAsync(outPath, buf);
  const offset = -video.duration + currentTime;
  return transferTimestampsWithOffset(filePath, outPath, offset);
}

module.exports = captureFrame;
