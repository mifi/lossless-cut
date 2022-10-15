import strongDataUri from 'strong-data-uri';

import { getSuffixedOutPath, transferTimestamps } from './util';
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

export async function captureFramesFfmpeg({ customOutDir, filePath, fromTime, captureFormat, enableTransferTimestamps, numFrames }) {
  const time = formatDuration({ seconds: fromTime, fileNameFriendly: true });
  let nameSuffix;
  if (numFrames > 1) {
    const numDigits = Math.floor(Math.log10(numFrames)) + 1;
    nameSuffix = `${time}-%0${numDigits}d.${captureFormat}`;
  } else {
    nameSuffix = `${time}.${captureFormat}`;
  }
  const outPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix });
  await ffmpegCaptureFrame({ timestamp: fromTime, videoPath: filePath, outPath, numFrames });

  if (enableTransferTimestamps && numFrames === 1) await transferTimestamps(filePath, outPath, fromTime);
  return outPath;
}

export async function captureFrameFromTag({ customOutDir, filePath, currentTime, captureFormat, video, enableTransferTimestamps }) {
  const buf = getFrameFromVideo(video, captureFormat);

  const ext = mime.extension(buf.mimetype);
  const time = formatDuration({ seconds: currentTime, fileNameFriendly: true });

  const outPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `${time}.${ext}` });
  await fs.writeFile(outPath, buf);

  if (enableTransferTimestamps) await transferTimestamps(filePath, outPath, currentTime);
  return outPath;
}
