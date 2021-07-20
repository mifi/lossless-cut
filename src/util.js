import Swal from 'sweetalert2';
import i18n from 'i18next';
import lodashTemplate from 'lodash/template';

const path = window.require('path');
const fs = window.require('fs-extra');
const open = window.require('open');
const os = window.require('os');

export function getOutDir(customOutDir, filePath) {
  if (customOutDir) return customOutDir;
  if (filePath) return path.dirname(filePath);
  return undefined;
}

export function getFileBaseName(filePath) {
  if (!filePath) return undefined;
  const parsed = path.parse(filePath);
  return parsed.name;
}

export function getOutPath(customOutDir, filePath, nameSuffix) {
  if (!filePath) return undefined;
  return path.join(getOutDir(customOutDir, filePath), `${getFileBaseName(filePath)}-${nameSuffix}`);
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
    if (err.code === 'EPERM') return false; // Thrown on Mac (MAS build) when user has not yet allowed access
    if (err.code === 'EACCES') return false; // Thrown on Linux when user doesn't have access to output dir
    console.error(err);
  }
  return true;
}

export async function dirExists(dirPath) {
  return (await fs.exists(dirPath)) && (await fs.lstat(dirPath)).isDirectory();
}

export async function transferTimestamps(inPath, outPath, offset = 0) {
  try {
    const { atime, mtime } = await fs.stat(inPath);
    await fs.utimes(outPath, (atime.getTime() / 1000) + offset, (mtime.getTime() / 1000) + offset);
  } catch (err) {
    console.error('Failed to set output file modified time', err);
  }
}

export const toast = Swal.mixin({
  toast: true,
  position: 'top',
  showConfirmButton: false,
  timer: 5000,
  timerProgressBar: true,
  didOpen: (self) => {
    self.addEventListener('mouseenter', Swal.stopTimer);
    self.addEventListener('mouseleave', Swal.resumeTimer);
  },
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

export function withBlur(cb) {
  return (e) => {
    cb(e);
    e.target.blur();
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
export const isMac = platform === 'darwin';

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
