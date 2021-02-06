import padStart from 'lodash/padStart';
import Swal from 'sweetalert2';
import i18n from 'i18next';
import lodashTemplate from 'lodash/template';

import randomColor from './random-color';

const path = window.require('path');
const fs = window.require('fs-extra');
const open = window.require('open');
const os = window.require('os');

export function formatDuration({ seconds: secondsIn, fileNameFriendly, fps }) {
  const seconds = secondsIn || 0;
  const secondsAbs = Math.abs(seconds);
  const minutes = secondsAbs / 60;
  const hours = minutes / 60;

  const hoursPadded = padStart(Math.floor(hours), 2, '0');
  const minutesPadded = padStart(Math.floor(minutes % 60), 2, '0');
  const secondsPadded = padStart(Math.floor(secondsAbs) % 60, 2, '0');
  const ms = secondsAbs - Math.floor(secondsAbs);
  const msPadded = fps != null
    ? padStart(Math.floor(ms * fps), 2, '0')
    : padStart(Math.floor(ms * 1000), 3, '0');

  // Be nice to filenames and use .
  const delim = fileNameFriendly ? '.' : ':';
  const sign = secondsIn < 0 ? '-' : '';
  return `${sign}${hoursPadded}${delim}${minutesPadded}${delim}${secondsPadded}.${msPadded}`;
}

export function parseDuration(str) {
  if (!str) return undefined;
  const match = str.trim().match(/^(-?)(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return undefined;
  const isNegatve = match[1] === '-';
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  const seconds = parseInt(match[4], 10);
  const ms = parseInt(match[5], 10);
  if (hours > 59 || minutes > 59 || seconds > 59) return undefined;

  let ret = (((((hours * 60) + minutes) * 60) + seconds) + (ms / 1000));
  if (isNegatve) ret *= -1;
  return ret;
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

export async function havePermissionToReadFile(filePath) {
  try {
    const fd = await fs.open(filePath, 'r');
    try {
      await fs.close(fd);
    } catch (err) {
      console.error('Failed to close fd', err);
    }
  } catch (err) {
    if (['EPERM', 'EACCES'].includes(err.code)) return false;
    console.error(err);
  }
  return true;
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
  const { value } = await toast.fire({ icon: 'success', ...props, timer: 13000, showConfirmButton: true, confirmButtonText: i18n.t('Show'), showCancelButton: true, cancelButtonText: i18n.t('Close') });
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

export function dragPreventer(ev) {
  ev.preventDefault();
}

// With these codecs, the player will not give a playback error, but instead only play audio
export function doesPlayerSupportFile(streams) {
  const videoStreams = streams.filter(s => s.codec_type === 'video');
  // Don't check audio formats, assume all is OK
  if (videoStreams.length === 0) return true;
  // If we have at least one video that is NOT of the unsupported formats, assume the player will be able to play it natively
  // https://github.com/mifi/lossless-cut/issues/595
  return videoStreams.some(s => !['hevc', 'prores', 'mpeg4'].includes(s.codec_name));
}

export const isMasBuild = window.process.mas;
export const isWindowsStoreBuild = window.process.windowsStore;
export const isStoreBuild = isMasBuild || isWindowsStoreBuild;

export const isDurationValid = (duration) => Number.isFinite(duration) && duration > 0;

const platform = os.platform();

export const isWindows = platform === 'win32';

export function getExtensionForFormat(format) {
  const ext = {
    matroska: 'mkv',
    ipod: 'm4a',
  }[format];

  return ext || format;
}

export function getOutFileExtension({ isCustomFormatSelected, outFormat, filePath }) {
  return isCustomFormatSelected ? `.${getExtensionForFormat(outFormat)}` : path.extname(filePath);
}

// eslint-disable-next-line no-template-curly-in-string
export const defaultOutSegTemplate = '${FILENAME}-${CUT_FROM}-${CUT_TO}${SEG_SUFFIX}${EXT}';

export function generateSegFileName({ template, inputFileNameWithoutExt, segSuffix, ext, segNum, segLabel, cutFrom, cutTo }) {
  const compiled = lodashTemplate(template);
  return compiled({ FILENAME: inputFileNameWithoutExt, SEG_SUFFIX: segSuffix, EXT: ext, SEG_NUM: segNum, SEG_LABEL: segLabel, CUT_FROM: cutFrom, CUT_TO: cutTo });
}

export const hasDuplicates = (arr) => new Set(arr).size !== arr.length;
