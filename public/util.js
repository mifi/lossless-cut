const os = require('os');

const frontendBuildDir = 'vite-dist';

// todo dedupe between renderer and main
const platform = os.platform();
const arch = os.arch();

const isWindows = platform === 'win32';
const isMac = platform === 'darwin';

module.exports = {
  frontendBuildDir,
  isWindows,
  isMac,
  platform,
  arch,
};
