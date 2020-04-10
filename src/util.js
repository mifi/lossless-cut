import padStart from 'lodash/padStart';
import Swal from 'sweetalert2';
import i18n from 'i18next';

import randomColor from './random-color';

const path = window.require('path');
const fs = window.require('fs-extra');
const open = window.require('open');


export function formatDuration({ seconds: _seconds, fileNameFriendly, fps }) {
  const seconds = _seconds || 0;
  const minutes = seconds / 60;
  const hours = minutes / 60;

  const hoursPadded = padStart(Math.floor(hours), 2, '0');
  const minutesPadded = padStart(Math.floor(minutes % 60), 2, '0');
  const secondsPadded = padStart(Math.floor(seconds) % 60, 2, '0');
  const ms = seconds - Math.floor(seconds);
  const msPadded = fps != null
    ? padStart(Math.floor(ms * fps), 2, '0')
    : padStart(Math.floor(ms * 1000), 3, '0');

  // Be nice to filenames and use .
  const delim = fileNameFriendly ? '.' : ':';
  return `${hoursPadded}${delim}${minutesPadded}${delim}${secondsPadded}.${msPadded}`;
}

export function parseDuration(str) {
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

export function getOutDir(customOutDir, filePath) {
  if (customOutDir) return customOutDir;
  if (filePath) return path.dirname(filePath);
  return undefined;
}

export function getOutPath(customOutDir, filePath, nameSuffix) {
  if (!filePath) return undefined;
  const parsed = path.parse(filePath);

  return path.join(getOutDir(customOutDir, filePath), `${parsed.name}-${nameSuffix}`);
}

export async function checkDirWriteAccess(dirPath) {
  try {
    await fs.access(dirPath, fs.constants.W_OK);
  } catch (err) {
    if (err.code === 'EPERM') return false;
    // if (err.code === 'EACCES') return false;
    console.error(err);
  }
  return true;
}

export async function dirExists(dirPath) {
  return (await fs.exists(dirPath)) && (await fs.lstat(dirPath)).isDirectory();
}

export async function transferTimestamps(inPath, outPath) {
  try {
    const stat = await fs.stat(inPath);
    await fs.utimes(outPath, stat.atime.getTime() / 1000, stat.mtime.getTime() / 1000);
  } catch (err) {
    console.error('Failed to set output file modified time', err);
  }
}

export async function transferTimestampsWithOffset(inPath, outPath, offset) {
  try {
    const stat = await fs.stat(inPath);
    const time = (stat.mtime.getTime() / 1000) + offset;
    await fs.utimes(outPath, time, time);
  } catch (err) {
    console.error('Failed to set output file modified time', err);
  }
}

export const toast = Swal.mixin({
  toast: true,
  position: 'top',
  showConfirmButton: false,
  timer: 5000,
});

export const errorToast = (title) => toast.fire({
  icon: 'error',
  title,
});

export const openDirToast = async ({ dirPath, ...props }) => {
  const { value } = await toast.fire({ icon: 'success', ...props, timer: 10000, showConfirmButton: true, confirmButtonText: 'Show', showCancelButton: true, cancelButtonText: 'Close' });
  if (value) open(dirPath);
};

export async function showFfmpegFail(err) {
  console.error(err);
  return errorToast(`${i18n.t('Failed to run ffmpeg:')} ${err.stack}`);
}

export function setFileNameTitle(filePath) {
  const appName = 'LosslessCut';
  document.title = filePath ? `${appName} - ${path.basename(filePath)}` : appName;
}

export function filenamify(name) {
  return name.replace(/[^0-9a-zA-Z_.]/g, '_');
}

export async function promptTimeOffset(inputValue) {
  const { value } = await Swal.fire({
    title: i18n.t('Set custom start time offset'),
    text: i18n.t('Instead of video apparently starting at 0, you can offset by a specified value (useful for viewing/cutting videos according to timecodes)'),
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

export function generateColor() {
  return randomColor(1, 0.95);
}

export function withBlur(cb) {
  return (e) => {
    cb(e);
    e.target.blur();
  };
}

export function getSegColors(seg) {
  if (!seg) return {};
  const { color } = seg;
  return {
    segBgColor: color.alpha(0.5).string(),
    segActiveBgColor: color.lighten(0.5).alpha(0.5).string(),
    segBorderColor: color.lighten(0.5).string(),
  };
}

export async function askForHtml5ifySpeed(allowedOptions) {
  const availOptions = {
    fastest: i18n.t('Fastest: Low playback speed (no audio)'),
    fast: i18n.t('Fast: Full quality remux (no audio), likely to fail'),
    'fast-audio': i18n.t('Fast: Full quality remux, likely to fail'),
    slow: i18n.t('Slow: Low quality encode (no audio)'),
    'slow-audio': i18n.t('Slow: Low quality encode'),
    slowest: i18n.t('Slowest: High quality encode'),
  };
  const inputOptions = {};
  allowedOptions.forEach((allowedOption) => {
    inputOptions[allowedOption] = availOptions[allowedOption];
  });

  const { value } = await Swal.fire({
    title: i18n.t('Convert to supported format'),
    input: 'radio',
    inputValue: 'fastest',
    text: i18n.t('These options will let you convert files to a format that is supported by the player. You can try different options and see which works with your file. Note that the conversion is for preview only. When you run an export, the output will still be lossless with full quality'),
    showCancelButton: true,
    customClass: { input: 'swal2-losslesscut-radio' },
    inputOptions,
    inputValidator: (v) => !v && i18n.t('You need to choose something!'),
  });

  return value;
}
