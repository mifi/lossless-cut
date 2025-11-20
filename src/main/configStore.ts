import Store from 'electron-store';
// eslint-disable-next-line import/no-extraneous-dependencies
import electron from 'electron';
import { join, dirname } from 'node:path';
import { pathExists } from 'fs-extra';
import assert from 'node:assert';
import { copyFile } from 'node:fs/promises';

import { KeyBinding, Config } from '../common/types.js';
import logger from './logger.js';
import { isWindows } from './util.js';
import { fallbackLng } from './i18nCommon.js';

const { app } = electron;


const defaultKeyBindings: KeyBinding[] = [
  { keys: 'ShiftLeft+Equal', action: 'addSegment' },
  { keys: 'Space', action: 'togglePlayResetSpeed' },
  { keys: 'KeyK', action: 'togglePlayNoResetSpeed' },
  { keys: 'KeyJ', action: 'reducePlaybackRate' },
  { keys: 'ShiftLeft+KeyJ', action: 'reducePlaybackRateMore' },
  { keys: 'KeyL', action: 'increasePlaybackRate' },
  { keys: 'ShiftLeft+KeyL', action: 'increasePlaybackRateMore' },
  { keys: 'KeyZ', action: 'timelineToggleComfortZoom' },
  { keys: 'ShiftLeft+KeyZ', action: 'makeCursorTimeZero' },
  { keys: 'Comma', action: 'seekPreviousFrame' },
  { keys: 'Period', action: 'seekNextFrame' },
  { keys: 'KeyC', action: 'captureSnapshot' },
  { keys: 'ControlLeft+KeyC', action: 'copySegmentsToClipboard' },
  { keys: 'MetaLeft+KeyC', action: 'copySegmentsToClipboard' },
  { keys: 'ShiftLeft+KeyC', action: 'captureSnapshotToClipboard' },

  { keys: 'KeyI', action: 'setCutStart' },
  { keys: 'KeyO', action: 'setCutEnd' },
  { keys: 'Backspace', action: 'removeCurrentCutpoint' },
  { keys: 'KeyD', action: 'cleanupFilesDialog' },
  { keys: 'KeyB', action: 'splitCurrentSegment' },
  { keys: 'KeyR', action: 'increaseRotation' },
  { keys: 'KeyG', action: 'goToTimecode' },
  { keys: 'KeyT', action: 'toggleStripAll' },
  { keys: 'ShiftLeft+KeyT', action: 'toggleStripCurrentFilter' },

  { keys: 'ArrowLeft', action: 'seekBackwards' },
  { keys: 'ControlLeft+ShiftLeft+ArrowLeft', action: 'seekBackwards2' },
  { keys: 'ControlLeft+ArrowLeft', action: 'seekBackwardsPercent' },
  { keys: 'MetaLeft+ArrowLeft', action: 'seekBackwardsPercent' },
  { keys: 'AltLeft+ArrowLeft', action: 'seekBackwardsKeyframe' },
  { keys: 'ShiftLeft+ArrowLeft', action: 'jumpCutStart' },

  { keys: 'ArrowRight', action: 'seekForwards' },
  { keys: 'ControlLeft+ShiftLeft+ArrowRight', action: 'seekForwards2' },
  { keys: 'ControlLeft+ArrowRight', action: 'seekForwardsPercent' },
  { keys: 'MetaLeft+ArrowRight', action: 'seekForwardsPercent' },
  { keys: 'AltLeft+ArrowRight', action: 'seekForwardsKeyframe' },
  { keys: 'ShiftLeft+ArrowRight', action: 'jumpCutEnd' },

  { keys: 'ControlLeft+Home', action: 'jumpTimelineStart' },
  { keys: 'ControlLeft+End', action: 'jumpTimelineEnd' },

  { keys: 'PageUp', action: 'jumpFirstSegment' },
  { keys: 'ArrowUp', action: 'jumpPrevSegment' },
  { keys: 'ShiftLeft+AltLeft+PageUp', action: 'jumpSeekFirstSegment' },
  { keys: 'ShiftLeft+AltLeft+ArrowUp', action: 'jumpSeekPrevSegment' },
  { keys: 'ControlLeft+ArrowUp', action: 'timelineZoomIn' },
  { keys: 'MetaLeft+ArrowUp', action: 'timelineZoomIn' },
  { keys: 'ShiftLeft+ArrowUp', action: 'batchPreviousFile' },
  { keys: 'ControlLeft+ShiftLeft+ArrowUp', action: 'batchOpenPreviousFile' },

  { keys: 'PageDown', action: 'jumpLastSegment' },
  { keys: 'ArrowDown', action: 'jumpNextSegment' },
  { keys: 'ShiftLeft+AltLeft+PageDown', action: 'jumpSeekLastSegment' },
  { keys: 'ShiftLeft+AltLeft+ArrowDown', action: 'jumpSeekNextSegment' },
  { keys: 'ControlLeft+ArrowDown', action: 'timelineZoomOut' },
  { keys: 'MetaLeft+ArrowDown', action: 'timelineZoomOut' },
  { keys: 'ShiftLeft+ArrowDown', action: 'batchNextFile' },
  { keys: 'ControlLeft+ShiftLeft+ArrowDown', action: 'batchOpenNextFile' },

  { keys: 'ShiftLeft+Enter', action: 'batchOpenSelectedFile' },

  // https://github.com/mifi/lossless-cut/issues/610
  { keys: 'ControlLeft+KeyZ', action: 'undo' },
  { keys: 'MetaLeft+KeyZ', action: 'undo' },
  { keys: 'ControlLeft+ShiftLeft+KeyZ', action: 'redo' },
  { keys: 'MetaLeft+ShiftLeft+KeyZ', action: 'redo' },

  { keys: 'KeyF', action: 'toggleFullscreenVideo' },

  { keys: 'Enter', action: 'labelCurrentSegment' },

  { keys: 'KeyE', action: 'export' },
  { keys: 'ShiftLeft+Slash', action: 'toggleKeyboardShortcuts' },

  { keys: 'AltLeft+ArrowUp', action: 'increaseVolume' },
  { keys: 'AltLeft+ArrowDown', action: 'decreaseVolume' },
  { keys: 'KeyM', action: 'toggleMuted' },
];

const defaults: Config = {
  version: 1,
  lastAppVersion: app.getVersion() === '3.67.0' ? '3.64.0' : app.getVersion(),
  // todo change it to this in next version:
  // lastAppVersion: app.getVersion(),
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
  playbackVolume: 0.3, // so that we don't shock new users with loud volume
  autoSaveProjectFile: true,
  wheelSensitivity: 0.2,
  waveformHeight: 40,
  language: fallbackLng,
  ffmpegExperimental: false,
  preserveChapters: true,
  preserveMetadata: 'default',
  preserveMetadataOnMerge: false,
  preserveMovData: false,
  fixCodecTag: 'never',
  movFastStart: true,
  avoidNegativeTs: 'make_zero',
  hideNotifications: undefined,
  hideOsNotifications: undefined,
  autoLoadTimecode: false,
  segmentsToChapters: false,
  simpleMode: true,
  outSegTemplate: undefined,
  mergedFileTemplate: undefined,
  mergedFilesTemplate: undefined,
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
  segmentMouseModifierKey: 'shift',
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
  waveformMode: undefined,
  thumbnailsEnabled: false,
  keyframesEnabled: true,
  reducedMotion: 'user',
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

async function tryBackupConfigFile(oldConfigVersion: number, appVersion: string) {
  try {
    const configPath = getConfigPath();
    const backupPath = `${configPath}.backup-v${appVersion}-${oldConfigVersion}-${Date.now()}`;
    await copyFile(configPath, backupPath);
    logger.info(`Backed up config file to ${backupPath}`);
  } catch (err) {
    logger.error('Failed to backup config file', err);
  }
}

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

  const configVersion: number = store.get('version');

  // todo remove after a while
  if (configVersion === 1) {
    await tryBackupConfigFile(1, app.getVersion());

    const keyBindings: KeyBinding[] = store.get('keyBindings');
    const newBindings = keyBindings.map(({ keys: keysStr, action }) => {
      try {
        const keysOrig = keysStr.split('+');
        assert(keysOrig.length > 0 && keysOrig.every((k) => k.length > 0), 'Invalid keys');

        const map: Record<string, string> = {
          /* eslint-disable quote-props */
          'esc': 'Escape',
          '1': 'Digit1',
          '2': 'Digit2',
          '3': 'Digit3',
          '4': 'Digit4',
          '5': 'Digit5',
          '6': 'Digit6',
          '7': 'Digit7',
          '8': 'Digit8',
          '9': 'Digit9',
          '0': 'Digit0',
          '-': 'Minus',
          '=': 'Equal',
          'backspace': 'Backspace',
          'tab': 'Tab',
          'q': 'KeyQ',
          'w': 'KeyW',
          'e': 'KeyE',
          'r': 'KeyR',
          't': 'KeyT',
          'y': 'KeyY',
          'u': 'KeyU',
          'i': 'KeyI',
          'o': 'KeyO',
          'p': 'KeyP',
          '[': 'BracketLeft',
          ']': 'BracketRight',
          'enter': 'Enter',
          'a': 'KeyA',
          's': 'KeyS',
          'd': 'KeyD',
          'f': 'KeyF',
          'g': 'KeyG',
          'h': 'KeyH',
          'j': 'KeyJ',
          'k': 'KeyK',
          'l': 'KeyL',
          ';': 'Semicolon',
          '\'': 'Quote',
          '`': 'Backquote',
          '\\': 'Backslash',
          'z': 'KeyZ',
          'x': 'KeyX',
          'c': 'KeyC',
          'v': 'KeyV',
          'b': 'KeyB',
          'n': 'KeyN',
          'm': 'KeyM',
          ',': 'Comma',
          '.': 'Period',
          '/': 'Slash',
          '*': 'NumpadMultiply',
          'space': 'Space',
          'capslock': 'CapsLock',
          'f1': 'F1',
          'f2': 'F2',
          'f3': 'F3',
          'f4': 'F4',
          'f5': 'F5',
          'f6': 'F6',
          'f7': 'F7',
          'f8': 'F8',
          'f9': 'F9',
          'f10': 'F10',
          'pause': 'Pause',
          'f11': 'F11',
          'f12': 'F12',
          'f13': 'F13',
          'f14': 'F14',
          'f15': 'F15',
          'f16': 'F16',
          'f17': 'F17',
          'f18': 'F18',
          'f19': 'F19',
          'f20': 'F20',
          'f21': 'F21',
          'f22': 'F22',
          'f23': 'F23',
          'f24': 'F24',
          '(': 'NumpadParenLeft',
          ')': 'NumpadParenRight',
          'help': 'Help',
          'numlock': 'NumLock',
          'home': 'Home',
          'up': 'ArrowUp',
          'pageup': 'PageUp',
          'left': 'ArrowLeft',
          'right': 'ArrowRight',
          'end': 'End',
          'down': 'ArrowDown',
          'pagedown': 'PageDown',
          'ins': 'Insert',
          'del': 'Delete',

          // modifiers
          'ctrl': 'ControlLeft',
          'shift': 'ShiftLeft',
          'alt': 'AltLeft',
          'meta': 'MetaLeft',
          /* eslint-enable quote-props */
        };

        const newKeys = keysOrig.flatMap((k) => {
          if (k === 'plus') return ['shift', '='];
          if (k === 'command') return ['meta'];
          if (k === 'option') return ['alt'];
          return [k];
        }).map((k) => {
          const mapped = map[k.toLowerCase()];
          assert(mapped != null, `Unknown key: ${k}`);
          return mapped;
        });

        return { keys: newKeys.join('+'), action };
      } catch (err) {
        logger.error('Failed to migrate old keyboard binding', keysStr, action, err);
        return { keys: keysStr, action };
      }
    });
    set('keyBindings', newBindings);

    logger.info('Migrated config to version 2');
    set('version', 2);
  }
}
