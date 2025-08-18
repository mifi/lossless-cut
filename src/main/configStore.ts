import Store from 'electron-store';
// eslint-disable-next-line import/no-extraneous-dependencies
import electron from 'electron';
import { join, dirname } from 'node:path';
import { pathExists } from 'fs-extra';

import { KeyBinding, Config } from '../../types.js';
import logger from './logger.js';
import { isWindows } from './util.js';

const { app } = electron;


const defaultKeyBindings: KeyBinding[] = [
  { keys: 'plus', action: 'addSegment' },
  { keys: 'space', action: 'togglePlayResetSpeed' },
  { keys: 'k', action: 'togglePlayNoResetSpeed' },
  { keys: 'j', action: 'reducePlaybackRate' },
  { keys: 'shift+j', action: 'reducePlaybackRateMore' },
  { keys: 'l', action: 'increasePlaybackRate' },
  { keys: 'shift+l', action: 'increasePlaybackRateMore' },
  { keys: 'z', action: 'timelineToggleComfortZoom' },
  { keys: 'shift+z', action: 'makeCursorTimeZero' },
  { keys: ',', action: 'seekPreviousFrame' },
  { keys: '.', action: 'seekNextFrame' },
  { keys: 'c', action: 'captureSnapshot' },
  { keys: 'i', action: 'setCutStart' },
  { keys: 'o', action: 'setCutEnd' },
  { keys: 'backspace', action: 'removeCurrentCutpoint' },
  { keys: 'd', action: 'cleanupFilesDialog' },
  { keys: 'b', action: 'splitCurrentSegment' },
  { keys: 'r', action: 'increaseRotation' },
  { keys: 'g', action: 'goToTimecode' },
  { keys: 't', action: 'toggleStripAll' },
  { keys: 'shift+t', action: 'toggleStripCurrentFilter' },

  { keys: 'left', action: 'seekBackwards' },
  { keys: 'ctrl+shift+left', action: 'seekBackwards2' },
  { keys: 'ctrl+left', action: 'seekBackwardsPercent' },
  { keys: 'command+left', action: 'seekBackwardsPercent' },
  { keys: 'alt+left', action: 'seekBackwardsKeyframe' },
  { keys: 'shift+left', action: 'jumpCutStart' },

  { keys: 'right', action: 'seekForwards' },
  { keys: 'ctrl+shift+right', action: 'seekForwards2' },
  { keys: 'ctrl+right', action: 'seekForwardsPercent' },
  { keys: 'command+right', action: 'seekForwardsPercent' },
  { keys: 'alt+right', action: 'seekForwardsKeyframe' },
  { keys: 'shift+right', action: 'jumpCutEnd' },

  { keys: 'ctrl+home', action: 'jumpTimelineStart' },
  { keys: 'ctrl+end', action: 'jumpTimelineEnd' },

  { keys: 'pageup', action: 'jumpFirstSegment' },
  { keys: 'up', action: 'jumpPrevSegment' },
  { keys: 'shift+alt+pageup', action: 'jumpSeekFirstSegment' },
  { keys: 'shift+alt+up', action: 'jumpSeekPrevSegment' },
  { keys: 'ctrl+up', action: 'timelineZoomIn' },
  { keys: 'command+up', action: 'timelineZoomIn' },
  { keys: 'shift+up', action: 'batchPreviousFile' },
  { keys: 'ctrl+shift+up', action: 'batchOpenPreviousFile' },

  { keys: 'pagedown', action: 'jumpLastSegment' },
  { keys: 'down', action: 'jumpNextSegment' },
  { keys: 'shift+alt+pagedown', action: 'jumpSeekLastSegment' },
  { keys: 'shift+alt+down', action: 'jumpSeekNextSegment' },
  { keys: 'ctrl+down', action: 'timelineZoomOut' },
  { keys: 'command+down', action: 'timelineZoomOut' },
  { keys: 'shift+down', action: 'batchNextFile' },
  { keys: 'ctrl+shift+down', action: 'batchOpenNextFile' },

  { keys: 'shift+enter', action: 'batchOpenSelectedFile' },

  // https://github.com/mifi/lossless-cut/issues/610
  { keys: 'ctrl+z', action: 'undo' },
  { keys: 'command+z', action: 'undo' },
  { keys: 'ctrl+shift+z', action: 'redo' },
  { keys: 'command+shift+z', action: 'redo' },

  { keys: 'ctrl+c', action: 'copySegmentsToClipboard' },
  { keys: 'command+c', action: 'copySegmentsToClipboard' },

  { keys: 'f', action: 'toggleFullscreenVideo' },

  { keys: 'enter', action: 'labelCurrentSegment' },

  { keys: 'e', action: 'export' },
  { keys: 'shift+/', action: 'toggleKeyboardShortcuts' },
  { keys: 'escape', action: 'closeActiveScreen' },

  { keys: 'alt+up', action: 'increaseVolume' },
  { keys: 'alt+down', action: 'decreaseVolume' },
  { keys: 'm', action: 'toggleMuted' },
];

const defaults: Config = {
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
  waveformHeight: 40,
  language: undefined,
  ffmpegExperimental: false,
  preserveChapters: true,
  preserveMetadata: 'default',
  preserveMetadataOnMerge: false,
  preserveMovData: false,
  movFastStart: true,
  avoidNegativeTs: 'make_zero',
  hideNotifications: undefined,
  hideOsNotifications: undefined,
  autoLoadTimecode: false,
  segmentsToChapters: false,
  simpleMode: true,
  outSegTemplate: undefined,
  mergedFileTemplate: undefined,
  keyboardSeekAccFactor: 1.03,
  keyboardNormalSeekSpeed: 1,
  keyboardSeekSpeed2: 10,
  keyboardSeekSpeed3: 60,
  treatInputFileModifiedTimeAsStart: true,
  treatOutputFileModifiedTimeAsStart: true,
  outFormatLocked: undefined,
  safeOutputFileName: true,
  windowBounds: undefined,
  enableAutoHtml5ify: true,
  keyBindings: defaultKeyBindings,
  customFfPath: undefined,
  storeProjectInWorkingDir: true,
  enableOverwriteOutput: true,
  mouseWheelZoomModifierKey: 'ctrl',
  mouseWheelFrameSeekModifierKey: 'alt',
  mouseWheelKeyframeSeekModifierKey: 'shift',
  captureFrameMethod: 'videotag', // we don't default to ffmpeg because ffmpeg might choose a frame slightly off
  captureFrameQuality: 0.95,
  captureFrameFileNameFormat: 'timestamp',
  enableNativeHevc: true,
  enableUpdateCheck: true,
  cleanupChoices: {
    trashTmpFiles: true, askForCleanup: true, closeFile: true, cleanupAfterExport: false,
  },
  allowMultipleInstances: false,
  darkMode: true,
  preferStrongColors: false,
  outputFileNameMinZeroPadding: 1,
  cutFromAdjustmentFrames: 0,
  cutToAdjustmentFrames: 0,
  invertTimelineScroll: undefined,
  storeWindowBounds: true,
};

const configFileName = 'config.json'; // note: this is also hard-coded inside electron-store

// look for a config.json file next to the executable
// For portable app: https://github.com/mifi/lossless-cut/issues/645
async function lookForNeighbourConfigFile() {
  try {
    // https://github.com/mifi/lossless-cut/issues/645#issuecomment-1001363314
    // https://stackoverflow.com/questions/46307797/how-to-get-the-original-path-of-a-portable-electron-app
    // https://github.com/electron-userland/electron-builder/blob/master/docs/configuration/nsis.md
    if (!isWindows || process.windowsStore) return undefined;
    const appExeDir = process.env['PORTABLE_EXECUTABLE_DIR'] || dirname(app.getPath('exe'));
    const customConfigPath = join(appExeDir, configFileName);
    if (await pathExists(customConfigPath)) return appExeDir;

    return undefined;
  } catch (err) {
    logger.error('Failed to get custom storage path', err);
    return undefined;
  }
}

let store: Store;

export function get<T extends keyof Config>(key: T): Config[T] {
  return store.get(key);
}

export function set<T extends keyof Config>(key: T, val: Config[T]) {
  if (val === undefined) store.delete(key);
  else store.set(key, val);
}

export function reset<T extends keyof Config>(key: T) {
  set(key, defaults[key]);
}

async function tryCreateStore({ customStoragePath }: { customStoragePath: string | undefined }) {
  for (let i = 0; i < 5; i += 1) {
    try {
      store = new Store({
        defaults,
        ...(customStoragePath != null ? { cwd: customStoragePath } : {}),
      });
      return;
    } catch (err) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 2000));
      logger.error('Failed to create config store, retrying', err);
    }
  }

  throw new Error('Timed out while creating config store');
}

let customStoragePath: string | undefined;

export const getConfigPath = () => customStoragePath ?? join(app.getPath('userData'), configFileName); // custom path, or default used by electron-store

export async function init({ customConfigDir }: { customConfigDir: string | undefined }) {
  customStoragePath = customConfigDir ?? await lookForNeighbourConfigFile();
  if (customStoragePath) logger.info('customStoragePath', customStoragePath);

  await tryCreateStore({ customStoragePath });

  // migrate old configs:
  const enableTransferTimestamps = store.get('enableTransferTimestamps'); // todo remove after a while
  if (enableTransferTimestamps != null) {
    logger.info('Migrating enableTransferTimestamps');
    store.delete('enableTransferTimestamps');
    set('treatOutputFileModifiedTimeAsStart', enableTransferTimestamps ? true : undefined);
  }

  const cleanupChoices = store.get('cleanupChoices'); // todo remove after a while
  if (cleanupChoices != null && cleanupChoices.closeFile == null) {
    logger.info('Migrating cleanupChoices.closeFile');
    set('cleanupChoices', { ...cleanupChoices, closeFile: true });
  }
}
