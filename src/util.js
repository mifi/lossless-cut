import i18n from 'i18next';
import pMap from 'p-map';
import ky from 'ky';
import prettyBytes from 'pretty-bytes';
import sortBy from 'lodash/sortBy';
import pRetry from 'p-retry';

import isDev from './isDev';
import Swal, { toast } from './swal';
import { ffmpegExtractWindow } from './util/constants';

const { dirname, parse: parsePath, join, extname, isAbsolute, resolve, basename } = window.require('path');
const fsExtra = window.require('fs-extra');
const { stat, readdir } = window.require('fs/promises');
const os = window.require('os');
const { ipcRenderer } = window.require('electron');
const remote = window.require('@electron/remote');

const { unlink } = fsExtra;


const trashFile = async (path) => ipcRenderer.invoke('tryTrashItem', path);

export const showItemInFolder = async (path) => ipcRenderer.invoke('showItemInFolder', path);


export function getFileDir(filePath) {
  return filePath ? dirname(filePath) : undefined;
}

export function getOutDir(customOutDir, filePath) {
  if (customOutDir) return customOutDir;
  if (filePath) return getFileDir(filePath);
  return undefined;
}

function getFileBaseName(filePath) {
  if (!filePath) return undefined;
  const parsed = parsePath(filePath);
  return parsed.name;
}

export function getOutPath({ customOutDir, filePath, fileName }) {
  if (!filePath) return undefined;
  return join(getOutDir(customOutDir, filePath), fileName);
}

export const getSuffixedFileName = (filePath, nameSuffix) => `${getFileBaseName(filePath)}-${nameSuffix}`;

export function getSuffixedOutPath({ customOutDir, filePath, nameSuffix }) {
  if (!filePath) return undefined;
  return getOutPath({ customOutDir, filePath, fileName: getSuffixedFileName(filePath, nameSuffix) });
}

export async function havePermissionToReadFile(filePath) {
  try {
    const fd = await fsExtra.open(filePath, 'r');
    try {
      await fsExtra.close(fd);
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
    await fsExtra.access(dirPath, fsExtra.constants.W_OK);
  } catch (err) {
    if (err.code === 'EPERM') return false; // Thrown on Mac (MAS build) when user has not yet allowed access
    if (err.code === 'EACCES') return false; // Thrown on Linux when user doesn't have access to output dir
    console.error(err);
  }
  return true;
}

export async function pathExists(pathIn) {
  return fsExtra.pathExists(pathIn);
}

export async function getPathReadAccessError(pathIn) {
  try {
    await fsExtra.access(pathIn, fsExtra.constants.R_OK);
    return undefined;
  } catch (err) {
    return err.code;
  }
}

export async function dirExists(dirPath) {
  return (await pathExists(dirPath)) && (await fsExtra.lstat(dirPath)).isDirectory();
}

export async function transferTimestamps({ inPath, outPath, cutFrom = 0, cutTo = 0, duration = 0, treatInputFileModifiedTimeAsStart = true, treatOutputFileModifiedTimeAsStart }) {
  if (treatOutputFileModifiedTimeAsStart == null) return; // null means disabled;

  // see https://github.com/mifi/lossless-cut/issues/1017#issuecomment-1049097115
  function calculateTime(fileTime) {
    if (treatInputFileModifiedTimeAsStart && treatOutputFileModifiedTimeAsStart) {
      return fileTime + cutFrom;
    }
    if (!treatInputFileModifiedTimeAsStart && !treatOutputFileModifiedTimeAsStart) {
      return fileTime - duration + cutTo;
    }
    if (treatInputFileModifiedTimeAsStart && !treatOutputFileModifiedTimeAsStart) {
      return fileTime + cutTo;
    }
    // if (!treatInputFileModifiedTimeAsStart && treatOutputFileModifiedTimeAsStart) {
    return fileTime - duration + cutFrom;
  }

  try {
    const { atime, mtime } = await stat(inPath);
    await fsExtra.utimes(outPath, calculateTime((atime.getTime() / 1000)), calculateTime((mtime.getTime() / 1000)));
  } catch (err) {
    console.error('Failed to set output file modified time', err);
  }
}

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

export function filenamify(name) {
  return name.replace(/[^0-9a-zA-Z_\-.]/g, '_');
}

export function withBlur(cb) {
  return (e) => {
    cb(e);
    e.target?.blur();
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
    adts: 'aac',
    mpegts: 'ts',
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

  // user is changing format, must update extension too
  return `.${getExtensionForFormat(outFormat)}`;
}

export const hasDuplicates = (arr) => new Set(arr).size !== arr.length;

// Need to resolve relative paths from the command line https://github.com/mifi/lossless-cut/issues/639
export const resolvePathIfNeeded = (inPath) => (isAbsolute(inPath) ? inPath : resolve(inPath));

export const html5ifiedPrefix = 'html5ified-';
export const html5dummySuffix = 'dummy';

export async function findExistingHtml5FriendlyFile(fp, cod) {
  // The order is the priority we will search:
  const suffixes = ['slowest', 'slow-audio', 'slow', 'fast-audio-remux', 'fast-audio', 'fast', 'fastest-audio', 'fastest-audio-remux', html5dummySuffix];
  const prefix = getSuffixedFileName(fp, html5ifiedPrefix);

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

export async function deleteFiles({ paths, deleteIfTrashFails, signal }) {
  const failedToTrashFiles = [];

  // const testFail = isDev;
  const testFail = false;

  // eslint-disable-next-line no-restricted-syntax
  for (const path of paths) {
    try {
      if (testFail) throw new Error('test trash failure');
      // eslint-disable-next-line no-await-in-loop
      await trashFile(path);
      signal.throwIfAborted();
    } catch (err) {
      console.error(err);
      failedToTrashFiles.push(path);
    }
  }

  if (failedToTrashFiles.length === 0) return; // All good!

  if (!deleteIfTrashFails) {
    const { value } = await Swal.fire({
      icon: 'warning',
      text: i18n.t('Unable to move file to trash. Do you want to permanently delete it?'),
      confirmButtonText: i18n.t('Permanently delete'),
      showCancelButton: true,
    });
    if (!value) return;
  }

  // Retry because sometimes it fails on windows #272 #1797
  await pMap(failedToTrashFiles, async (path) => {
    await pRetry(async () => {
      if (testFail) throw new Error('test delete failure');
      await unlink(path);
    }, {
      retries: 3,
      signal,
      onFailedAttempt: async () => {
        console.warn('Retrying delete', path);
      },
    });
  }, { concurrency: 1 });
}

export const deleteDispositionValue = 'llc_disposition_remove';

export const mirrorTransform = 'matrix(-1, 0, 0, 1, 0, 0)';

// I *think* Windows will throw error with code ENOENT if ffprobe/ffmpeg fails (execa), but other OS'es will return this error code if a file is not found, so it would be wrong to attribute it to exec failure.
// see https://github.com/mifi/lossless-cut/issues/451
export const isExecaFailure = (err) => err.exitCode === 1 || (isWindows && err.code === 'ENOENT');

// A bit hacky but it works, unless someone has a file called "No space left on device" ( ͡° ͜ʖ ͡°)
export const isOutOfSpaceError = (err) => (
  err && isExecaFailure(err)
  && typeof err.stderr === 'string' && err.stderr.includes('No space left on device')
);

export async function checkAppPath() {
  try {
    const forceCheck = false;
    // const forceCheck = isDev;
    // this code is purposefully obfuscated to try to detect the most basic cloned app submissions to the MS Store
    if (!isWindowsStoreBuild && !forceCheck) return;
    // eslint-disable-next-line no-useless-concat, one-var, one-var-declaration-per-line
    const mf = 'mi' + 'fi.no', llc = 'Los' + 'slessC' + 'ut';
    const appPath = isDev ? 'C:\\Program Files\\WindowsApps\\37672NoveltyStudio.MediaConverter_9.0.6.0_x64__vjhnv588cyf84' : remote.app.getAppPath();
    const pathMatch = appPath.replace(/\\/g, '/').match(/Windows ?Apps\/([^/]+)/); // find the first component after WindowsApps
    // example pathMatch: 37672NoveltyStudio.MediaConverter_9.0.6.0_x64__vjhnv588cyf84
    if (!pathMatch) {
      console.warn('Unknown path match', appPath);
      return;
    }
    const pathSeg = pathMatch[1];
    if (pathSeg.startsWith(`57275${mf}.${llc}_`)) return;
    // this will report the path and may return a msg
    const url = `https://losslesscut-analytics.mifi.no/${pathSeg.length}/${encodeURIComponent(btoa(pathSeg))}`;
    // console.log('Reporting app', pathSeg, url);
    const response = await ky(url).json();
    if (response.invalid) toast.fire({ timer: 60000, icon: 'error', title: response.title, text: response.text });
  } catch (err) {
    if (isDev) console.warn(err.message);
  }
}

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

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export const readFileSize = async (path) => (await stat(path)).size;

export const readFileSizes = (paths) => pMap(paths, async (path) => readFileSize(path), { concurrency: 5 });

export function checkFileSizes(inputSize, outputSize) {
  const diff = Math.abs(outputSize - inputSize);
  const relDiff = diff / inputSize;
  const maxDiffPercent = 5;
  const sourceFilesTotalSize = prettyBytes(inputSize);
  const outputFileTotalSize = prettyBytes(outputSize);
  if (relDiff > maxDiffPercent / 100) return i18n.t('The size of the merged output file ({{outputFileTotalSize}}) differs from the total size of source files ({{sourceFilesTotalSize}}) by more than {{maxDiffPercent}}%. This could indicate that there was a problem during the merge.', { maxDiffPercent, sourceFilesTotalSize, outputFileTotalSize });
  return undefined;
}

function setDocumentExtraTitle(extra) {
  const baseTitle = 'LosslessCut';
  if (extra != null) document.title = `${baseTitle} - ${extra}`;
  else document.title = baseTitle;
}

export function setDocumentTitle({ filePath, working, cutProgress }) {
  const parts = [];
  if (filePath) parts.push(basename(filePath));
  if (working) {
    parts.push('-', working);
    if (cutProgress != null) parts.push(`${(cutProgress * 100).toFixed(1)}%`);
  }
  setDocumentExtraTitle(parts.length > 0 ? parts.join(' ') : undefined);
}

export function mustDisallowVob() {
  // Because Apple is being nazi about the ability to open "copy protected DVD files"
  if (isMasBuild) {
    toast.fire({ icon: 'error', text: 'Unfortunately .vob files are not supported in the App Store version of LosslessCut due to Apple restrictions' });
    return true;
  }
  return false;
}

export async function readVideoTs(videoTsPath) {
  const files = await readdir(videoTsPath);
  const relevantFiles = files.filter((file) => /^VTS_\d+_\d+\.vob$/i.test(file) && !/^VTS_\d+_00\.vob$/i.test(file)); // skip menu
  const ret = sortBy(relevantFiles).map((file) => join(videoTsPath, file));
  if (ret.length === 0) throw new Error('No VTS vob files found in folder');
  return ret;
}

export function getImportProjectType(filePath) {
  if (filePath.endsWith('Summary.txt')) return 'dv-analyzer-summary-txt';
  const edlFormatForExtension = { csv: 'csv', pbf: 'pbf', edl: 'mplayer', cue: 'cue', xml: 'xmeml', fcpxml: 'fcpxml' };
  const matchingExt = Object.keys(edlFormatForExtension).find((ext) => filePath.toLowerCase().endsWith(`.${ext}`));
  if (!matchingExt) return undefined;
  return edlFormatForExtension[matchingExt];
}

export const calcShouldShowWaveform = (zoomedDuration) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);
export const calcShouldShowKeyframes = (zoomedDuration) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);
