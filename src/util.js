const _ = require('lodash');
const path = require('path');
const fs = require('fs-extra');
const Swal = require('sweetalert2');

const randomColor = require('./random-color');


function formatDuration({ seconds: _seconds, fileNameFriendly, fps }) {
  const seconds = _seconds || 0;
  const minutes = seconds / 60;
  const hours = minutes / 60;

  const hoursPadded = _.padStart(Math.floor(hours), 2, '0');
  const minutesPadded = _.padStart(Math.floor(minutes % 60), 2, '0');
  const secondsPadded = _.padStart(Math.floor(seconds) % 60, 2, '0');
  const ms = seconds - Math.floor(seconds);
  const msPadded = fps != null
    ? _.padStart(Math.floor(ms * fps), 2, '0')
    : _.padStart(Math.floor(ms * 1000), 3, '0');

  // Be nice to filenames and use .
  const delim = fileNameFriendly ? '.' : ':';
  return `${hoursPadded}${delim}${minutesPadded}${delim}${secondsPadded}.${msPadded}`;
}

function parseDuration(str) {
  if (!str) return undefined;
  const match = str.trim().match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return undefined;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const ms = parseInt(match[4], 10);
  if (hours > 59 || minutes > 59 || seconds > 59) return undefined;

  return ((((hours * 60) + minutes) * 60) + seconds) + (ms / 1000);
}

function getOutDir(customOutDir, filePath) {
  if (customOutDir) return customOutDir;
  if (filePath) return path.dirname(filePath);
  return undefined;
}

function getOutPath(customOutDir, filePath, nameSuffix) {
  if (!filePath) return undefined;
  const parsed = path.parse(filePath);

  return path.join(getOutDir(customOutDir, filePath), `${parsed.name}-${nameSuffix}`);
}

async function transferTimestamps(inPath, outPath) {
  try {
    const stat = await fs.stat(inPath);
    await fs.utimes(outPath, stat.atime.getTime() / 1000, stat.mtime.getTime() / 1000);
  } catch (err) {
    console.error('Failed to set output file modified time', err);
  }
}

async function transferTimestampsWithOffset(inPath, outPath, offset) {
  try {
    const stat = await fs.stat(inPath);
    const time = (stat.mtime.getTime() / 1000) + offset;
    await fs.utimes(outPath, time, time);
  } catch (err) {
    console.error('Failed to set output file modified time', err);
  }
}

const toast = Swal.mixin({
  toast: true,
  position: 'top',
  showConfirmButton: false,
  timer: 5000,
});

const errorToast = (title) => toast.fire({
  icon: 'error',
  title,
});

async function showFfmpegFail(err) {
  console.error(err);
  return errorToast(`Failed to run ffmpeg: ${err.stack}`);
}

function setFileNameTitle(filePath) {
  const appName = 'LosslessCut';
  document.title = filePath ? `${appName} - ${path.basename(filePath)}` : appName;
}

function filenamify(name) {
  return name.replace(/[^0-9a-zA-Z_.]/g, '_');
}

async function promptTimeOffset(inputValue) {
  const { value } = await Swal.fire({
    title: 'Set custom start time offset',
    text: 'Instead of video apparently starting at 0, you can offset by a specified value (useful for viewing/cutting videos according to timecodes)',
    input: 'text',
    inputValue: inputValue || '',
    showCancelButton: true,
    inputPlaceholder: '00:00:00.000',
  });

  if (value === undefined) {
    return undefined;
  }

  const duration = parseDuration(value);
  // Invalid, try again
  if (duration === undefined) return promptTimeOffset(value);

  return duration;
}

function generateColor() {
  return randomColor(1, 0.95);
}

function withBlur(cb) {
  return (e) => {
    cb(e);
    e.target.blur();
  };
}

function getSegColors(seg) {
  if (!seg) return {};
  const { color } = seg;
  return {
    segBgColor: color.alpha(0.5).string(),
    segActiveBgColor: color.lighten(0.5).alpha(0.5).string(),
    segBorderColor: color.lighten(0.5).string(),
  };
}


module.exports = {
  formatDuration,
  parseDuration,
  getOutPath,
  getOutDir,
  transferTimestamps,
  transferTimestampsWithOffset,
  toast,
  errorToast,
  showFfmpegFail,
  setFileNameTitle,
  promptTimeOffset,
  generateColor,
  filenamify,
  withBlur,
  getSegColors,
};
