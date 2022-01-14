import strongDataUri from 'strong-data-uri';

import { getOutPath, transferTimestamps } from './util';
import { formatDuration } from './util/duration';

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

export async function captureFrameFfmpeg({ customOutDir, filePath, currentTime, captureFormat, enableTransferTimestamps }) {
  const time = formatDuration({ seconds: currentTime, fileNameFriendly: true });

  const outPath = getOutPath({ customOutDir, filePath, nameSuffix: `${time}.${captureFormat}` });
  await ffmpegCaptureFrame({ timestamp: currentTime, videoPath: filePath, outPath });

  if (enableTransferTimestamps) await transferTimestamps(filePath, outPath, currentTime);
  return outPath;
}

export async function captureFrameFromTag({ customOutDir, filePath, currentTime, captureFormat, video, enableTransferTimestamps }) {
  const buf = getFrameFromVideo(video, captureFormat);

  const ext = mime.extension(buf.mimetype);
  const time = formatDuration({ seconds: currentTime, fileNameFriendly: true });

  const outPath = getOutPath({ customOutDir, filePath, nameSuffix: `${time}.${ext}` });
  await fs.writeFile(outPath, buf);

  if (enableTransferTimestamps) await transferTimestamps(filePath, outPath, currentTime);
  return outPath;
}
