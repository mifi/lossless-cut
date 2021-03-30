const path = require('path');
const fs = require('fs-extra');
const open = require('open');
const os = require('os');
const trash = require('trash');
const mime = require('mime-types');
const cueParser = require('cue-parser');
const stringToStream = require('string-to-stream');


const { remote } = require('electron');

function focusWindow() {
  try {
    remote.app.focus({ steal: true });
  } catch (err) {
    console.error('Failed to focus window', err);
  }
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

async function havePermissionToReadFile(filePath) {
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

async function checkDirWriteAccess(dirPath) {
  try {
    await fs.access(dirPath, fs.constants.W_OK);
  } catch (err) {
    if (err.code === 'EPERM') return false; // Thrown on Mac (MAS build) when user has not yet allowed access
    if (err.code === 'EACCES') return false; // Thrown on Linux when user doesn't have access to output dir
    console.error(err);
  }
  return true;
}

async function dirExists(dirPath) {
  return (await fs.exists(dirPath)) && (await fs.lstat(dirPath)).isDirectory();
}

async function transferTimestamps(inPath, outPath, offset = 0) {
  try {
    const { atime, mtime } = await fs.stat(inPath);
    await fs.utimes(outPath, (atime.getTime() / 1000) + offset, (mtime.getTime() / 1000) + offset);
  } catch (err) {
    console.error('Failed to set output file modified time', err);
  }
}

const getBaseName = (p) => path.basename(p);

function getExtensionForFormat(format) {
  const ext = {
    matroska: 'mkv',
    ipod: 'm4a',
  }[format];

  return ext || format;
}

function getOutFileExtension({ isCustomFormatSelected, outFormat, filePath }) {
  return isCustomFormatSelected ? `.${getExtensionForFormat(outFormat)}` : path.extname(filePath);
}

const platform = os.platform();
const isWindows = platform === 'win32';

// TODO test!!!!
const isMasBuild = process.mas;
const isWindowsStoreBuild = process.windowsStore;
const isStoreBuild = isMasBuild || isWindowsStoreBuild;


const getAppVersion = () => remote.app.getVersion();

const openExternal = (url) => remote.shell.openExternal(url);

const buildMenuFromTemplate = (template) => remote.Menu.buildFromTemplate(template);

module.exports = {
  open,
  isWindows,
  getBaseName,
  getOutFileExtension,
  getExtensionForFormat,
  transferTimestamps,
  dirExists,
  checkDirWriteAccess,
  havePermissionToReadFile,
  getOutPath,
  getOutDir,
  focusWindow,
  getAppVersion,
  dialog: remote.dialog,
  trash,
  getExtensionFromMime: mime.extension,
  parseCueFile: (p) => cueParser.parse(p),
  openExternal,
  platform,
  buildMenuFromTemplate,
  isMasBuild,
  isWindowsStoreBuild,
  isStoreBuild,
  stringToStream,
};
