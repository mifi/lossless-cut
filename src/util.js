import Swal from 'sweetalert2';
import i18n from 'i18next';
import lodashTemplate from 'lodash/template';
import pMap from 'p-map';

const { dirname, parse: parsePath, join, basename, extname, isAbsolute, resolve } = window.require('path');
const fs = window.require('fs-extra');
const open = window.require('open');
const os = window.require('os');
const trash = window.require('trash');

const { readdir, unlink } = fs;

export function getOutDir(customOutDir, filePath) {
  if (customOutDir) return customOutDir;
  if (filePath) return dirname(filePath);
  return undefined;
}

export function getFileBaseName(filePath) {
  if (!filePath) return undefined;
  const parsed = parsePath(filePath);
  return parsed.name;
}

export function getOutPath(customOutDir, filePath, nameSuffix) {
  if (!filePath) return undefined;
  return join(getOutDir(customOutDir, filePath), `${getFileBaseName(filePath)}-${nameSuffix}`);
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

export async function pathExists(pathIn) {
  return fs.pathExists(pathIn);
}

export async function dirExists(dirPath) {
  return (await pathExists(dirPath)) && (await fs.lstat(dirPath)).isDirectory();
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
  showCloseButton: true,
  timer: 5000,
  timerProgressBar: true,
  didOpen: (self) => {
    self.addEventListener('mouseenter', Swal.stopTimer);
    self.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export const errorToast = (text) => toast.fire({
  icon: 'error',
  text,
});

export function handleError(arg1, arg2) {
  console.error('handleError', arg1, arg2);

  let msg;
  let errorMsg;
  if (typeof arg1 === 'string') msg = arg1;
  else if (typeof arg2 === 'string') msg = arg2;

  if (arg1 instanceof Error) errorMsg = arg1.message;
  if (arg2 instanceof Error) errorMsg = arg2.message;

  toast.fire({
    icon: 'error',
    title: msg || i18n.t('An error has occurred.'),
    text: errorMsg ? errorMsg.substr(0, 300) : undefined,
  });
}


export const openDirToast = async ({ dirPath, ...props }) => {
  const { value } = await toast.fire({ icon: 'success', timer: 5000, showConfirmButton: true, confirmButtonText: i18n.t('Show'), showCancelButton: true, cancelButtonText: i18n.t('Close'), ...props });
  if (value) open(dirPath);
};

export function setFileNameTitle(filePath) {
  const appName = 'LosslessCut';
  document.title = filePath ? `${appName} - ${basename(filePath)}` : appName;
}

export function filenamify(name) {
  return name.replace(/[^0-9a-zA-Z_\-.]/g, '_');
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

export const platform = os.platform();

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
  return isCustomFormatSelected ? `.${getExtensionForFormat(outFormat)}` : extname(filePath);
}

// This is used as a fallback and so it has to always generate unique file names
// eslint-disable-next-line no-template-curly-in-string
export const defaultOutSegTemplate = '${FILENAME}-${CUT_FROM}-${CUT_TO}${SEG_SUFFIX}${EXT}';

export function generateSegFileName({ template, inputFileNameWithoutExt, segSuffix, ext, segNum, segLabel, cutFrom, cutTo, tags }) {
  const compiled = lodashTemplate(template);
  const data = {
    FILENAME: inputFileNameWithoutExt,
    SEG_SUFFIX: segSuffix,
    EXT: ext,
    SEG_NUM: segNum,
    SEG_LABEL: segLabel,
    CUT_FROM: cutFrom,
    CUT_TO: cutTo,
    SEG_TAGS: Object.fromEntries(Object.entries(tags).map(([key, value]) => [`${key.toLocaleUpperCase('en-US')}`, value])),
  };
  return compiled(data);
}

export const hasDuplicates = (arr) => new Set(arr).size !== arr.length;

// Need to resolve relative paths from the command line https://github.com/mifi/lossless-cut/issues/639
export const resolvePathIfNeeded = (inPath) => (isAbsolute(inPath) ? inPath : resolve(inPath));

export const html5ifiedPrefix = 'html5ified-';
export const html5dummySuffix = 'dummy';

export async function findExistingHtml5FriendlyFile(fp, cod) {
  // The order is the priority we will search:
  const suffixes = ['slowest', 'slow-audio', 'slow', 'fast-audio', 'fast', 'fastest-audio', 'fastest-audio-remux', html5dummySuffix];
  const prefix = `${getFileBaseName(fp)}-${html5ifiedPrefix}`;

  const outDir = getOutDir(cod, fp);
  const dirEntries = await readdir(outDir);

  const html5ifiedDirEntries = dirEntries.filter((entry) => entry.startsWith(prefix));

  let matches = [];
  suffixes.forEach((suffix) => {
    const entryWithSuffix = html5ifiedDirEntries.find((entry) => new RegExp(`${suffix}\\..*$`).test(entry.replace(prefix, '')));
    if (entryWithSuffix) matches = [...matches, { entry: entryWithSuffix, suffix }];
  });

  const nonMatches = html5ifiedDirEntries.filter((entry) => !matches.some((m) => m.entry === entry)).map((entry) => ({ entry }));

  // Allow for non-suffix matches too, e.g. user has a custom html5ified- file but with none of the suffixes above (but last priority)
  matches = [...matches, ...nonMatches];

  // console.log(matches);
  if (matches.length < 1) return undefined;

  const { suffix, entry } = matches[0];

  return {
    path: join(outDir, entry),
    usingDummyVideo: ['fastest-audio', 'fastest-audio-remux', html5dummySuffix].includes(suffix),
  };
}

export function getHtml5ifiedPath(cod, fp, type) {
  // See also inside ffmpegHtml5ify
  const ext = (isMac && ['slowest', 'slow', 'slow-audio'].includes(type)) ? 'mp4' : 'mkv';
  return getOutPath(cod, fp, `${html5ifiedPrefix}${type}.${ext}`);
}

export async function deleteFiles({ toDelete, paths: { previewFilePath, filePath, edlFilePath } }) {
  const failedToTrashFiles = [];

  if (toDelete.tmpFiles && previewFilePath) {
    try {
      await trash(previewFilePath);
    } catch (err) {
      console.error(err);
      failedToTrashFiles.push(previewFilePath);
    }
  }
  if (toDelete.projectFile && edlFilePath) {
    try {
      // throw new Error('test');
      await trash(edlFilePath);
    } catch (err) {
      console.error(err);
      failedToTrashFiles.push(edlFilePath);
    }
  }
  if (toDelete.sourceFile) {
    try {
      await trash(filePath);
    } catch (err) {
      console.error(err);
      failedToTrashFiles.push(filePath);
    }
  }

  if (failedToTrashFiles.length === 0) return; // All good!

  const { value } = await Swal.fire({
    icon: 'warning',
    text: i18n.t('Unable to move file to trash. Do you want to permanently delete it?'),
    confirmButtonText: i18n.t('Permanently delete'),
    showCancelButton: true,
  });

  if (value) {
    await pMap(failedToTrashFiles, async (path) => unlink(path), { concurrency: 1 });
  }
}
