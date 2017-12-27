const _ = require('lodash');
const path = require('path');
const fs = require('fs');

function formatDuration(_seconds) {
  const seconds = _seconds || 0;
  const minutes = seconds / 60;
  const hours = minutes / 60;

  const hoursPadded = _.padStart(Math.floor(hours), 2, '0');
  const minutesPadded = _.padStart(Math.floor(minutes % 60), 2, '0');
  const secondsPadded = _.padStart(Math.floor(seconds) % 60, 2, '0');
  const msPadded = _.padStart(Math.floor((seconds - Math.floor(seconds)) * 1000), 3, '0');

  // Be nice to filenames and use .
  return `${hoursPadded}.${minutesPadded}.${secondsPadded}.${msPadded}`;
}

function getOutPath(customOutDir, filePath, nameSuffix) {
  const basename = path.basename(filePath);

  return customOutDir ?
    path.join(customOutDir, `${basename}-${nameSuffix}`) :
    `${filePath}-${nameSuffix}`;
}

async function transferTimestamps(inPath, outPath) {
  try {
    const stat = await fs.statAsync(inPath);
    await fs.utimesAsync(outPath, stat.atime.getTime() / 1000, stat.mtime.getTime() / 1000);
  } catch (err) {
    console.error('Failed to set output file modified time', err);
  }
}

async function transferTimestampsWithOffset(inPath, outPath, offset) {
  try {
    const stat = await fs.statAsync(inPath);
    const time = (stat.mtime.getTime() / 1000) + offset;
    await fs.utimesAsync(outPath, time, time);
  } catch (err) {
    console.error('Failed to set output file modified time', err);
  }
}

module.exports = {
  formatDuration,
  getOutPath,
  transferTimestamps,
  transferTimestampsWithOffset,
};
