import Swal from 'sweetalert2';
import i18n from 'i18next';
import lodashTemplate from 'lodash/template';
import pMap from 'p-map';

const { dirname, parse: parsePath, join, basename, extname, isAbsolute, resolve } = window.require('path');
const fs = window.require('fs-extra');
const os = window.require('os');
const { shell } = window.require('electron');

const { readdir, unlink } = fs;

const trash = async (path) => shell.trashItem(path);

export function getFileDir(filePath) {
  return filePath ? dirname(filePath) : undefined;
}

export function getOutDir(customOutDir, filePath) {
  if (customOutDir) return customOutDir;
  if (filePath) return getFileDir(filePath);
  return undefined;
}

export function getFileBaseName(filePath) {
  if (!filePath) return undefined;
  const parsed = parsePath(filePath);
  return parsed.name;
}

export function getOutPath({ customOutDir, filePath, fileName }) {
  if (!filePath) return undefined;
  return join(getOutDir(customOutDir, filePath), fileName);
}

export function getSuffixedOutPath({ customOutDir, filePath, nameSuffix }) {
  if (!filePath) return undefined;
  return getOutPath({ customOutDir, filePath, fileName: `${getFileBaseName(filePath)}-${nameSuffix}` });
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

export async function getPathReadAccessError(pathIn) {
  try {
    await fs.access(pathIn, fs.constants.R_OK);
    return undefined;
  } catch (err) {
    return err.code;
  }
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

export const swalToastOptions = {
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
};

export const toast = Swal.mixin(swalToastOptions);

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
    text: errorMsg ? errorMsg.substring(0, 300) : undefined,
  });
}

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

export const isMasBuild = window.process.mas;
export const isWindowsStoreBuild = window.process.windowsStore;
export const isStoreBuild = isMasBuild || isWindowsStoreBuild;

export const platform = os.platform();
export const arch = os.arch();

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
  if (!isCustomFormatSelected) {
    const ext = extname(filePath);
    // QuickTime is quirky about the file extension of mov files (has to be .mov)
    // https://github.com/mifi/lossless-cut/issues/1075#issuecomment-1072084286
    const hasMovIncorrectExtension = outFormat === 'mov' && ext.toLowerCase() !== '.mov';

    // OK, just keep the current extension. Because most players will not care about the extension
    if (!hasMovIncorrectExtension) return extname(filePath);
  }
  return `.${getExtensionForFormat(outFormat)}`;
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
    SEG_TAGS: {
      // allow both original case and uppercase
      ...tags,
      ...Object.fromEntries(Object.entries(tags).map(([key, value]) => [`${key.toLocaleUpperCase('en-US')}`, value])),
    },
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
  const suffixes = ['slowest', 'slow-audio', 'slow', 'fast-audio-remux', 'fast-audio', 'fast', 'fastest-audio', 'fastest-audio-remux', html5dummySuffix];
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
  return getSuffixedOutPath({ customOutDir: cod, filePath: fp, nameSuffix: `${html5ifiedPrefix}${type}.${ext}` });
}

export async function deleteFiles({ toDelete, paths: { previewFilePath, sourceFilePath, projectFilePath } }) {
  const failedToTrashFiles = [];

  if (toDelete.tmpFiles && previewFilePath) {
    try {
      await trash(previewFilePath);
    } catch (err) {
      console.error(err);
      failedToTrashFiles.push(previewFilePath);
    }
  }
  if (toDelete.projectFile && projectFilePath) {
    try {
      // throw new Error('test');
      await trash(projectFilePath);
    } catch (err) {
      console.error(err);
      failedToTrashFiles.push(projectFilePath);
    }
  }
  if (toDelete.sourceFile) {
    try {
      await trash(sourceFilePath);
    } catch (err) {
      console.error(err);
      failedToTrashFiles.push(sourceFilePath);
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

export const deleteDispositionValue = 'llc_disposition_remove';

export const mirrorTransform = 'matrix(-1, 0, 0, 1, 0, 0)';

// A bit hacky but it works, unless someone has a file called "No space left on device" ( ͡° ͜ʖ ͡°)
export const isOutOfSpaceError = (err) => (
  err && (err.exitCode === 1 || err.code === 'ENOENT')
  && typeof err.stderr === 'string' && err.stderr.includes('No space left on device')
);

// https://stackoverflow.com/a/2450976/6519037
export function shuffleArray(arrayIn) {
  const array = [...arrayIn];
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}
