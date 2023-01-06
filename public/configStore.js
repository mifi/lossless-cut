const Store = require('electron-store');
const electron = require('electron');
const os = require('os');
const { join, dirname } = require('path');
const { pathExists } = require('fs-extra');

const logger = require('./logger');

const { app } = electron;


const defaultKeyBindings = [
  { keys: 'plus', action: 'addSegment' },
  { keys: 'space', action: 'togglePlayResetSpeed' },
  { keys: 'k', action: 'togglePlayNoResetSpeed' },
  { keys: 'j', action: 'reducePlaybackRate' },
  { keys: 'shift+j', action: 'reducePlaybackRateMore' },
  { keys: 'l', action: 'increasePlaybackRate' },
  { keys: 'shift+l', action: 'increasePlaybackRateMore' },
  { keys: 'z', action: 'timelineToggleComfortZoom' },
  { keys: ',', action: 'seekPreviousFrame' },
  { keys: '.', action: 'seekNextFrame' },
  { keys: 'c', action: 'captureSnapshot' },
  { keys: 'i', action: 'setCutStart' },
  { keys: 'o', action: 'setCutEnd' },
  { keys: 'backspace', action: 'removeCurrentSegment' },
  { keys: 'd', action: 'cleanupFilesDialog' },
  { keys: 'b', action: 'splitCurrentSegment' },
  { keys: 'r', action: 'increaseRotation' },
  { keys: 'g', action: 'goToTimecode' },

  { keys: 'left', action: 'seekBackwards' },
  { keys: 'ctrl+left', action: 'seekBackwardsPercent' },
  { keys: 'command+left', action: 'seekBackwardsPercent' },
  { keys: 'alt+left', action: 'seekBackwardsKeyframe' },
  { keys: 'shift+left', action: 'jumpCutStart' },

  { keys: 'right', action: 'seekForwards' },
  { keys: 'ctrl+right', action: 'seekForwardsPercent' },
  { keys: 'command+right', action: 'seekForwardsPercent' },
  { keys: 'alt+right', action: 'seekForwardsKeyframe' },
  { keys: 'shift+right', action: 'jumpCutEnd' },

  { keys: 'ctrl+home', action: 'jumpTimelineStart' },
  { keys: 'ctrl+end', action: 'jumpTimelineEnd' },

  { keys: 'up', action: 'jumpPrevSegment' },
  { keys: 'ctrl+up', action: 'timelineZoomIn' },
  { keys: 'command+up', action: 'timelineZoomIn' },
  { keys: 'shift+up', action: 'batchPreviousFile' },

  { keys: 'down', action: 'jumpNextSegment' },
  { keys: 'ctrl+down', action: 'timelineZoomOut' },
  { keys: 'command+down', action: 'timelineZoomOut' },
  { keys: 'shift+down', action: 'batchNextFile' },

  { keys: 'shift+enter', action: 'batchOpenSelectedFile' },

  // https://github.com/mifi/lossless-cut/issues/610
  { keys: 'ctrl+z', action: 'undo' },
  { keys: 'command+z', action: 'undo' },
  { keys: 'ctrl+shift+z', action: 'redo' },
  { keys: 'command+shift+z', action: 'redo' },

  { keys: 'enter', action: 'labelCurrentSegment' },

  { keys: 'e', action: 'export' },
  { keys: 'shift+/', action: 'toggleKeyboardShortcuts' },
  { keys: 'escape', action: 'closeActiveScreen' },

  { keys: 'alt+up', action: 'increaseVolume' },
  { keys: 'alt+down', action: 'decreaseVolume' },
];

const defaults = {
  captureFormat: 'jpeg',
  customOutDir: undefined,
  keyframeCut: true,
  autoMerge: false,
  autoDeleteMergedSegments: true,
  segmentsToChaptersOnly: false,
  enableSmartCut: false,
  timecodeFormat: 'timecodeWithDecimalFraction',
  invertCutSegments: false,
  autoExportExtraStreams: true,
  exportConfirmEnabled: true,
  askBeforeClose: false,
  enableAskForImportChapters: true,
  enableAskForFileOpenAction: true,
  playbackVolume: 1,
  autoSaveProjectFile: true,
  wheelSensitivity: 0.2,
  language: undefined,
  ffmpegExperimental: false,
  preserveMovData: false,
  movFastStart: true,
  avoidNegativeTs: 'make_zero',
  hideNotifications: undefined,
  autoLoadTimecode: false,
  segmentsToChapters: false,
  preserveMetadataOnMerge: false,
  simpleMode: true,
  outSegTemplate: undefined,
  keyboardSeekAccFactor: 1.03,
  keyboardNormalSeekSpeed: 1,
  enableTransferTimestamps: true,
  outFormatLocked: undefined,
  safeOutputFileName: true,
  windowBounds: undefined,
  enableAutoHtml5ify: true,
  keyBindings: defaultKeyBindings,
  customFfPath: undefined,
  storeProjectInWorkingDir: true,
  enableOverwriteOutput: true,
  mouseWheelZoomModifierKey: 'ctrl',
  captureFrameMethod: 'videotag', // we don't default to ffmpeg because ffmpeg might choose a frame slightly off
  captureFrameQuality: 0.95,
  captureFrameFileNameFormat: 'timestamp',
};

// For portable app: https://github.com/mifi/lossless-cut/issues/645
async function getCustomStoragePath() {
  try {
    const isWindows = os.platform() === 'win32';
    if (!isWindows || process.windowsStore) return undefined;

    // https://github.com/mifi/lossless-cut/issues/645#issuecomment-1001363314
    // https://stackoverflow.com/questions/46307797/how-to-get-the-original-path-of-a-portable-electron-app
    // https://github.com/electron-userland/electron-builder/blob/master/docs/configuration/nsis.md
    const customStorageDir = process.env.PORTABLE_EXECUTABLE_DIR || dirname(app.getPath('exe'));
    const customConfigPath = join(customStorageDir, 'config.json');
    if (await pathExists(customConfigPath)) return customStorageDir;
    return undefined;
  } catch (err) {
    logger.error('Failed to get custom storage path', err);
    return undefined;
  }
}

let store;

async function init() {
  const customStoragePath = await getCustomStoragePath();
  if (customStoragePath) logger.info('customStoragePath', customStoragePath);

  for (let i = 0; i < 5; i += 1) {
    try {
      store = new Store({ defaults, cwd: customStoragePath });
      return;
    } catch (err) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 2000));
      logger.error('Failed to create config store, retrying', err);
    }
  }

  throw new Error('Timed out while creating config store');
}

function get(key) {
  return store.get(key);
}

function set(key, val) {
  if (val === undefined) store.delete(key);
  else store.set(key, val);
}

function reset(key) {
  set(key, defaults[key]);
}

module.exports = {
  init,
  get,
  set,
  reset,
};
