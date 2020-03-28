import strongDataUri from 'strong-data-uri';

import { formatDuration, getOutPath, transferTimestampsWithOffset } from './util';

import { captureFrame as ffmpegCaptureFrame } from './ffmpeg';

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

async function transferTimestamps({ duration, currentTime, fromPath, toPath }) {
  const offset = -duration + currentTime;
  await transferTimestampsWithOffset(fromPath, toPath, offset);
}

export async function captureFrameFfmpeg({ customOutDir, videoPath, currentTime, captureFormat, duration }) {
  const time = formatDuration({ seconds: currentTime, fileNameFriendly: true });

  const outPath = getOutPath(customOutDir, videoPath, `${time}.${captureFormat}`);
  await ffmpegCaptureFrame({ timestamp: currentTime, videoPath, outPath });
  await transferTimestamps({ duration, currentTime, fromPath: videoPath, toPath: outPath });
  return outPath;
}

export async function captureFrameFromTag({ customOutDir, filePath, video, currentTime, captureFormat }) {
  const buf = getFrameFromVideo(video, captureFormat);

  const ext = mime.extension(buf.mimetype);
  const time = formatDuration({ seconds: currentTime, fileNameFriendly: true });

  const outPath = getOutPath(customOutDir, filePath, `${time}.${ext}`);
  await fs.writeFile(outPath, buf);

  await transferTimestamps({ duration: video.duration, currentTime, fromPath: filePath, toPath: outPath });
  return outPath;
}
