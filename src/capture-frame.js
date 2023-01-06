import dataUriToBuffer from 'data-uri-to-buffer';

import { getSuffixedOutPath, transferTimestamps } from './util';
import { formatDuration } from './util/duration';

import { captureFrame as ffmpegCaptureFrame, captureFrames as ffmpegCaptureFrames } from './ffmpeg';

const fs = window.require('fs-extra');
const mime = window.require('mime-types');

function getFrameFromVideo(video, format, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext('2d').drawImage(video, 0, 0);

  const dataUri = canvas.toDataURL(`image/${format}`, quality);

  return dataUriToBuffer(dataUri);
}

export async function captureFramesRange({ customOutDir, filePath, fromTime, toTime, captureFormat, quality, filter, onProgress }) {
  const time = formatDuration({ seconds: fromTime, fileNameFriendly: true });
  const numDigits = 5;
  const getSuffix = (numPart) => `${time}-${numPart}.${captureFormat}`;
  const nameTemplateSuffix = getSuffix(`%0${numDigits}d`);
  const nameSuffix = getSuffix(`${'1'.padStart(numDigits, '0')}`); // mimic ffmpeg
  const outPathTemplate = getSuffixedOutPath({ customOutDir, filePath, nameSuffix: nameTemplateSuffix });
  const firstFileOutPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix });
  await ffmpegCaptureFrames({ from: fromTime, to: toTime, videoPath: filePath, outPathTemplate, quality, filter, onProgress });
  return firstFileOutPath;
}

export async function captureFrameFromFfmpeg({ customOutDir, filePath, fromTime, captureFormat, enableTransferTimestamps, quality }) {
  const time = formatDuration({ seconds: fromTime, fileNameFriendly: true });
  const nameSuffix = `${time}.${captureFormat}`;
  const outPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix });
  await ffmpegCaptureFrame({ timestamp: fromTime, videoPath: filePath, outPath, quality });

  if (enableTransferTimestamps) await transferTimestamps(filePath, outPath, fromTime);
  return outPath;
}

export async function captureFrameFromTag({ customOutDir, filePath, currentTime, captureFormat, video, enableTransferTimestamps, quality }) {
  const buf = getFrameFromVideo(video, captureFormat, quality);

  const ext = mime.extension(buf.type);
  const time = formatDuration({ seconds: currentTime, fileNameFriendly: true });

  const outPath = getSuffixedOutPath({ customOutDir, filePath, nameSuffix: `${time}.${ext}` });
  await fs.writeFile(outPath, buf);

  if (enableTransferTimestamps) await transferTimestamps(filePath, outPath, currentTime);
  return outPath;
}
