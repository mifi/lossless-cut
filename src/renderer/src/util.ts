import i18n from 'i18next';
import pMap from 'p-map';
import prettyBytes from 'pretty-bytes';
import sortBy from 'lodash/sortBy';
import pRetry, { Options } from 'p-retry';
import { ExecaError } from 'execa';
import confetti from 'canvas-confetti';
import invariant from 'tiny-invariant';

import { ffmpegExtractWindow } from './util/constants';
import { appName } from '../../main/common';
import { Html5ifyMode } from '../../common/types';
import { UserFacingError } from '../errors';

const { dirname, parse: parsePath, join, extname, isAbsolute, resolve, basename } = window.require('path');
const fsExtra = window.require('fs-extra');
const { stat, lstat, readdir, utimes, unlink } = window.require('fs/promises');
const { ipcRenderer } = window.require('electron');
const remote = window.require('@electron/remote');
const { isWindows, isMac } = remote.require('./index.js');

const appVersion = remote.app.getVersion();
const appPath = remote.app.getAppPath();

export { isWindows, isMac, appVersion, appPath };


export const trashFile = async (path: string) => ipcRenderer.invoke('tryTrashItem', path);

export const showItemInFolder = async (path: string) => ipcRenderer.invoke('showItemInFolder', path);


export function getFileDir(filePath?: string) {
  return filePath ? dirname(filePath) : undefined;
}

export function getOutDir<T1 extends string | undefined, T2 extends string | undefined>(customOutDir?: T1, filePath?: T2): T1 extends string ? string : T2 extends string ? string : undefined;
export function getOutDir(customOutDir?: string | undefined, filePath?: string | undefined) {
  if (customOutDir != null) return customOutDir;
  if (filePath != null) return getFileDir(filePath);
  return undefined;
}

function getFileBaseName(filePath?: string) {
  if (!filePath) return undefined;
  const parsed = parsePath(filePath);
  return parsed.name;
}

export function getOutPath<T extends string | undefined>(a: { customOutDir?: string | undefined, filePath?: T | undefined, fileName: string }): T extends string ? string : undefined;
export function getOutPath({ customOutDir, filePath, fileName }: { customOutDir?: string | undefined, filePath?: string | undefined, fileName: string }) {
  if (filePath == null) return undefined;
  return join(getOutDir(customOutDir, filePath), fileName);
}

export const getDownloadMediaOutPath = (customOutDir: string, fileName: string) => join(customOutDir, fileName);

export const getSuffixedFileName = (filePath: string | undefined, nameSuffix: string) => `${getFileBaseName(filePath)}-${nameSuffix}`;

export function getSuffixedOutPath<T extends string | undefined>(a: { customOutDir?: string | undefined, filePath?: T | undefined, nameSuffix: string }): T extends string ? string : undefined;
export function getSuffixedOutPath({ customOutDir, filePath, nameSuffix }: { customOutDir?: string | undefined, filePath?: string | undefined, nameSuffix: string }) {
  if (filePath == null) return undefined;
  return getOutPath({ customOutDir, filePath, fileName: getSuffixedFileName(filePath, nameSuffix) });
}

export async function havePermissionToReadFile(filePath: string) {
  try {
    const fd = await fsExtra.open(filePath, 'r');
    try {
      await fsExtra.close(fd);
    } catch (err) {
      console.error('Failed to close fd', err);
    }
  } catch (err) {
    if (err instanceof Error && 'code' in err && ['EPERM', 'EACCES'].includes(err.code as string)) return false;
    console.error(err);
  }
  return true;
}

export async function checkDirWriteAccess(dirPath: string) {
  try {
    await fsExtra.access(dirPath, fsExtra.constants.W_OK);
  } catch (err) {
    if (err instanceof Error && 'code' in err) {
      if (err.code === 'EPERM') return false; // Thrown on Mac (MAS build) when user has not yet allowed access
      if (err.code === 'EACCES') return false; // Thrown on Linux when user doesn't have access to output dir
    }
    console.error(err);
  }
  return true;
}

export async function pathExists(pathIn: string) {
  return fsExtra.pathExists(pathIn);
}

export async function getPathReadAccessError(pathIn: string) {
  try {
    await fsExtra.access(pathIn, fsExtra.constants.R_OK);
    return undefined;
  } catch (err) {
    return err instanceof Error && 'code' in err && typeof err.code === 'string' ? err.code : undefined;
  }
}

export async function dirExists(dirPath: string) {
  return (await pathExists(dirPath)) && (await lstat(dirPath)).isDirectory();
}

// export const testFailFsOperation = isDev;
export const testFailFsOperation = false;

// Retry because sometimes write operations fail on windows due to the file being locked for various reasons (often anti-virus) #272 #1797 #1704
export async function fsOperationWithRetry(operation: () => Promise<unknown>, { signal, retries = 10, minTimeout = 100, maxTimeout = 2000, ...opts }: Options & { retries?: number | undefined, minTimeout?: number | undefined, maxTimeout?: number | undefined } = {}) {
  return pRetry(async () => {
    if (testFailFsOperation && Math.random() > 0.3) throw Object.assign(new Error('test delete failure'), { code: 'EPERM' });
    await operation();
    // @ts-expect-error todo
  }, {
    retries,
    signal,
    minTimeout,
    maxTimeout,
    // mimic fs.rm `maxRetries` https://nodejs.org/api/fs.html#fspromisesrmpath-options
    shouldRetry: (err) => err instanceof Error && 'code' in err && typeof err.code === 'string' && ['EBUSY', 'EMFILE', 'ENFILE', 'EPERM'].includes(err.code),
    ...opts,
  });
}

// example error: index-18074aaf.js:166 Failed to delete C:\Users\USERNAME\Desktop\RC\New folder\2023-12-27 21-45-22 (GMT p5)-merged-1703933052361-00.01.04.915-00.01.07.424-seg1.mp4 Error: EPERM: operation not permitted, unlink 'C:\Users\USERNAME\Desktop\RC\New folder\2023-12-27 21-45-22 (GMT p5)-merged-1703933052361-00.01.04.915-00.01.07.424-seg1.mp4'
export const unlinkWithRetry = async (path: string, options?: Options) => fsOperationWithRetry(async () => unlink(path), { ...options, onFailedAttempt: (error) => console.warn('Retrying delete', path, error.attemptNumber) });
// example error: index-18074aaf.js:160 Error: EPERM: operation not permitted, utime 'C:\Users\USERNAME\Desktop\RC\New folder\2023-12-27 21-45-22 (GMT p5)-merged-1703933052361-cut-merged-1703933070237.mp4'
export const utimesWithRetry = async (path: string, atime: number, mtime: number, options?: Options) => fsOperationWithRetry(async () => utimes(path, atime, mtime), { ...options, onFailedAttempt: (error) => console.warn('Retrying utimes', path, error.attemptNumber) });

export const getFrameDuration = (fps?: number) => 1 / (fps ?? 30);

export async function transferTimestamps({ inPath, outPath, cutFrom = 0, cutTo: cutToIn, duration = 0, treatInputFileModifiedTimeAsStart, treatOutputFileModifiedTimeAsStart }: {
  inPath: string,
  outPath: string,
  cutFrom?: number | undefined,
  cutTo?: number | undefined,
  duration: number | undefined,
  treatInputFileModifiedTimeAsStart: boolean,
  treatOutputFileModifiedTimeAsStart: boolean | null | undefined,
}) {
  if (treatOutputFileModifiedTimeAsStart == null) return; // null means time transfer is disabled (use current time);

  const cutTo = cutToIn ?? duration;

  // see https://github.com/mifi/lossless-cut/issues/1017#issuecomment-1049097115
  function calculateTime(fileTime: number) {
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
    await utimesWithRetry(outPath, calculateTime((atime.getTime() / 1000)), calculateTime((mtime.getTime() / 1000)));
  } catch (err) {
    console.error('Failed to set output file modified time', err);
  }
}

export function filenamify(name: string) {
  // \p{L}\p{N} are unicode letters and numbers
  return name.replaceAll(/[^\p{L}\p{N} .-_]/gu, '_');
}

// eslint-disable-next-line space-before-function-paren
export function withBlur<T extends { target?: { blur?: () => unknown } | object }>(cb: (a: T) => void) {
  return (e: T) => {
    cb(e);
    if (e.target && 'blur' in e.target) e.target?.blur?.();
  };
}

export function dragPreventer(ev: DragEvent) {
  ev.preventDefault();
}

export const isMasBuild = window.process.mas;
export const isWindowsStoreBuild = window.process.windowsStore;
export const isStoreBuild = isMasBuild || isWindowsStoreBuild;

export function getExtensionForFormat(format: string) {
  const ext = {
    matroska: 'mkv',
    ipod: 'm4a',
    adts: 'aac',
    mpegts: 'ts',
  }[format];

  return ext || format;
}

export function getOutFileExtension({ isCustomFormatSelected, outFormat, filePath }: {
  isCustomFormatSelected?: boolean, outFormat: string, filePath: string,
}) {
  if (!isCustomFormatSelected) {
    const inputExt = extname(filePath);
    // QuickTime is quirky about the file extension of mov files (has to be .mov)
    // https://github.com/mifi/lossless-cut/issues/1075#issuecomment-1072084286
    const hasMovIncorrectExtension = outFormat === 'mov' && inputExt.toLowerCase() !== '.mov';

    // OK, just keep the current extension. Because most other players will not care about the extension
    if (!hasMovIncorrectExtension) return inputExt;
  }

  // user is changing format, must update extension too
  return `.${getExtensionForFormat(outFormat)}`;
}

export const hasDuplicates = (arr: unknown[]) => new Set(arr).size !== arr.length;

// Need to resolve relative paths from the command line https://github.com/mifi/lossless-cut/issues/639
export const resolvePathIfNeeded = (inPath: string) => (isAbsolute(inPath) ? inPath : resolve(inPath));

export const html5ifiedPrefix = 'html5ified-';
export const html5dummySuffix = 'dummy';

export async function findExistingHtml5FriendlyFile(fp: string, cod: string | undefined) {
  // The order is the priority we will search:
  const suffixes = ['slowest', 'slow-audio', 'slow', 'fast-audio-remux', 'fast-audio', 'fast', html5dummySuffix];
  const prefix = getSuffixedFileName(fp, html5ifiedPrefix);

  const outDir = getOutDir(cod, fp);
  invariant(outDir != null);
  const dirEntries = await readdir(outDir);

  const html5ifiedDirEntries = dirEntries.filter((entry) => entry.startsWith(prefix));

  let matches: { entry: string, suffix?: string }[] = [];
  suffixes.forEach((suffix) => {
    const entryWithSuffix = html5ifiedDirEntries.find((entry) => new RegExp(`${suffix}\\..*$`).test(entry.replace(prefix, '')));
    if (entryWithSuffix) matches = [...matches, { entry: entryWithSuffix, suffix }];
  });

  const nonMatches = html5ifiedDirEntries.filter((entry) => !matches.some((m) => m.entry === entry)).map((entry) => ({ entry }));

  // Allow for non-suffix matches too, e.g. user has a custom html5ified- file but with none of the suffixes above (but last priority)
  matches = [...matches, ...nonMatches];

  // console.log(matches);
  if (matches.length === 0) return undefined;

  const { suffix, entry } = matches[0]!;

  return {
    path: join(outDir, entry),
    usingDummyVideo: suffix === html5dummySuffix,
  };
}

export function getHtml5ifiedPath(cod: string | undefined, fp: string, type: Html5ifyMode) {
  // See also inside ffmpegHtml5ify
  const ext = (isMac && ['slowest', 'slow', 'slow-audio'].includes(type)) ? 'mp4' : 'mkv';
  return getSuffixedOutPath({ customOutDir: cod, filePath: fp, nameSuffix: `${html5ifiedPrefix}${type}.${ext}` });
}


export const deleteDispositionValue = 'llc_disposition_remove';

export const mirrorTransform = 'matrix(-1, 0, 0, 1, 0, 0)';

// todo this is not a correct assumption
export type InvariantExecaError = ExecaError<{ encoding: 'utf8' }> | ExecaError<{ encoding: 'buffer' }>;

// We can't use `instanceof ExecaError` because the error has been sent over the main-renderer bridge (@electron/remote)
// so instead we just check if it has some of execa's specific error properties
export function isExecaError(err: unknown): err is InvariantExecaError {
  // https://github.com/sindresorhus/execa/blob/main/docs/api.md#resultfailed
  return err instanceof Error && ('failed' in err && 'shortMessage' in err && 'isForcefullyTerminated' in err);
}

export const isAbortedError = (err: unknown) => (
  // execa killed (aborted by user). isTerminated because runningFfmpegs process.kill
  (isExecaError(err) && (err.isCanceled || err.isTerminated))
  || (err instanceof Error && err.name === 'AbortError')
);

export const getStdioString = (stdio: string | Uint8Array) => (stdio instanceof Uint8Array ? Buffer.from(stdio).toString('utf8') : stdio);

// A bit hacky but it works, unless someone has a file called "No space left on device" ( ͡° ͜ʖ ͡°)
export const isOutOfSpaceError = (err: InvariantExecaError) => (
  err.exitCode !== 0
  && !!getStdioString(err.stderr)?.includes('No space left on device')
);

export const isMuxNotSupported = (err: InvariantExecaError) => (
  err.exitCode !== 0
  && err.stderr != null
  && /Could not write header .*incorrect codec parameters .*Invalid argument/.test(getStdioString(err.stderr) ?? '')
);

// https://stackoverflow.com/a/2450976/6519037
export function shuffleArray<T>(arrayIn: T[]) {
  const array = [...arrayIn];
  let currentIndex = array.length;
  let randomIndex: number;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex]!, array[currentIndex]!,
    ] as const;
  }

  return array;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegExp(str: string) {
  // eslint-disable-next-line unicorn/better-regex
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export const readFileSize = async (path: string) => (await stat(path)).size;

export const readFileSizes = (paths: string[]) => pMap(paths, async (path) => readFileSize(path), { concurrency: 5 });

export function checkFileSizes(inputSize: number, outputSize: number) {
  const diff = Math.abs(outputSize - inputSize);
  const relDiff = diff / inputSize;
  const maxDiffPercent = 5;
  const sourceFilesTotalSize = prettyBytes(inputSize);
  const outputFileTotalSize = prettyBytes(outputSize);
  if (relDiff > maxDiffPercent / 100) return i18n.t('The size of the merged output file ({{outputFileTotalSize}}) differs from the total size of source files ({{sourceFilesTotalSize}}) by more than {{maxDiffPercent}}%. This could indicate that there was a problem during the merge.', { maxDiffPercent, sourceFilesTotalSize, outputFileTotalSize });
  return undefined;
}

export function setDocumentTitle({ filePath, working, progress }: {
  filePath?: string | undefined,
  working?: string | undefined,
  progress?: number | undefined }) {
  const parts: string[] = [];

  if (working) {
    if (progress != null) parts.push(`${(progress * 100).toFixed(1)}%`);
    parts.push(working);
  }

  if (filePath) {
    parts.push(basename(filePath));
  }

  parts.push(isStoreBuild ? appName : `${appName} ${appVersion}`);

  document.title = parts.join(' - ');
}

export async function readVideoTs(videoTsPath: string) {
  const files = await readdir(videoTsPath);
  const relevantFiles = files.filter((file) => /^vts_\d+_\d+\.vob$/i.test(file) && !/^vts_\d+_00\.vob$/i.test(file)); // skip menu
  const ret = sortBy(relevantFiles).map((file) => join(videoTsPath, file));
  if (ret.length === 0) throw new UserFacingError(i18n.t('No VTS vob files found in folder'));
  return ret;
}

export async function readDirRecursively(dirPath: string) {
  const files = await readdir(dirPath, { recursive: true });
  const ret = (await pMap(files, async (path) => {
    if (['.DS_Store'].includes(basename(path))) return [];

    const absPath = join(dirPath, path);
    const fileStat = await lstat(absPath); // readdir also returns directories...
    if (!fileStat.isFile()) return [];

    return [absPath];
  }, { concurrency: 5 })).flat();

  if (ret.length === 0) throw new UserFacingError(i18n.t('No files found in folder'));
  return ret;
}

export function getImportProjectType(filePath: string) {
  if (filePath.endsWith('Summary.txt')) return 'dv-analyzer-summary-txt';
  const edlFormatForExtension = { csv: 'csv', pbf: 'pbf', edl: 'edl', cue: 'cue', xml: 'xmeml', fcpxml: 'fcpxml', otio: 'otio' } as const;
  const matchingExt = Object.keys(edlFormatForExtension).find((ext) => filePath.toLowerCase().endsWith(`.${ext}`)) as keyof typeof edlFormatForExtension | undefined;
  if (!matchingExt) return undefined;
  return edlFormatForExtension[matchingExt];
}

export const calcShouldShowWaveform = (zoomedDuration: number | undefined) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);
export const calcShouldShowKeyframes = (zoomedDuration: number | undefined) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);

export const mediaSourceQualities = ['HD', 'SD', 'OG']; // OG is original

export const splitKeyboardKeys = (keys: string) => keys.split('+');

// source: https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
// copy([...new Set([temp1, temp2, temp3].map((t) => t.querySelectorAll('tr td:nth-child(3) code:first-child')).flatMap((l) => [...l]).map((code) => code.innerText.replace(/"/g, '')))].join('\n'))
export const shiftModifiers = new Set(['ShiftLeft', 'ShiftRight']);
export const controlModifiers = new Set(['ControlLeft', 'ControlRight']);
export const altModifiers = new Set(['AltLeft', 'AltRight']);
export const metaModifiers = new Set(['MetaLeft', 'MetaRight']);
export const allModifiers = new Set([...shiftModifiers, ...controlModifiers, ...altModifiers, ...metaModifiers]);


export function getMetaKeyName() {
  if (isMac) return i18n.t('⌘ Cmd');
  if (isWindows) return i18n.t('⊞ Win');
  return i18n.t('Meta');
}

export const dialogButtonOrder = isWindows ? 'rtl' : 'ltr'; // use ltr for mac and linux, rtl for windows

export function shootConfetti(options?: confetti.Options) {
  confetti({
    particleCount: 30,
    angle: 110,
    startVelocity: 30,
    spread: 40,
    ticks: 25,
    disableForReducedMotion: true,
    origin: {
      x: 0.98,
      // since they fall down, start a bit higher than random
      y: 1.03,
    },
    ...options,
  });
}
