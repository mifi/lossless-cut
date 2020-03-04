import strongDataUri from 'strong-data-uri';

import { formatDuration, getOutPath, transferTimestampsWithOffset } from './util';

const fs = window.require('fs-extra');
const mime = window.require('mime-types');

function getFrameFromVideo(video, format) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext('2d').drawImage(video, 0, 0);

  const dataUri = canvas.toDataURL(`image/${format}`);

  return strongDataUri.decode(dataUri);
}

export default async function captureFrame(customOutDir, filePath, video, currentTime, captureFormat) {
  const buf = getFrameFromVideo(video, captureFormat);

  const ext = mime.extension(buf.mimetype);
  const time = formatDuration({ seconds: currentTime, fileNameFriendly: true });

  const outPath = getOutPath(customOutDir, filePath, `${time}.${ext}`);
  await fs.writeFile(outPath, buf);
  const offset = -video.duration + currentTime;
  return transferTimestampsWithOffset(filePath, outPath, offset);
}
