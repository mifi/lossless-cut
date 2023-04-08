const os = require('os');

const frontendBuildDir = 'vite-dist';

const platform = os.platform();
const arch = os.arch();

// todo dedupe between renderer and main
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';
const isLinux = platform === 'linux';

module.exports = {
  frontendBuildDir,
  isWindows,
  isMac,
  isLinux,
  platform,
  arch,
};
