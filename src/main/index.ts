process.traceDeprecation = true;
process.traceProcessWarnings = true;

/* eslint-disable import/first */
// eslint-disable-next-line import/no-extraneous-dependencies
import electron, { BrowserWindow, BrowserWindowConstructorOptions, nativeTheme, shell, app, ipcMain, Notification, NotificationConstructorOptions } from 'electron';
import i18n from 'i18next';
import debounce from 'lodash.debounce';
import yargsParser from 'yargs-parser';
import JSON5 from 'json5';
import remote from '@electron/remote/main';
import { stat } from 'node:fs/promises';
import assert from 'node:assert';
import timers from 'node:timers/promises';

import logger from './logger.js';
import menu from './menu.js';
import * as configStore from './configStore.js';
import { isWindows } from './util.js';
import { appName } from './common.js';
import attachContextMenu from './contextMenu.js';
import HttpServer from './httpServer.js';
import isDev from './isDev.js';
import isStoreBuild from './isStoreBuild.js';
import { getAboutPanelOptions } from './aboutPanel.js';

import { checkNewVersion } from './updateChecker.js';

import * as i18nCommon from './i18nCommon.js';

import './i18n.js';
import { ApiActionRequest } from '../../types.js';

export * as ffmpeg from './ffmpeg.js';

export * as i18n from './i18nCommon.js';

export * as compatPlayer from './compatPlayer.js';

export * as configStore from './configStore.js';

export { isLinux, isWindows, isMac, platform } from './util.js';

export { pathToFileURL } from 'node:url';

export { downloadMediaUrl } from './ffmpeg.js';


const electronUnhandled = import('electron-unhandled');
export const fileTypePromise = import('file-type/node');

// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
  try {
    (await electronUnhandled).default({ showDialog: true, logger: (err) => logger.error('electron-unhandled', err) });
  } catch (err) {
    logger.error(err);
  }
})();

// eslint-disable-next-line unicorn/prefer-export-from
export { isDev };

// https://chromestatus.com/feature/5748496434987008
// https://peter.sh/experiments/chromium-command-line-switches/
// https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/runtime_enabled_features.json5
app.commandLine.appendSwitch('enable-blink-features', 'AudioVideoTracks');

remote.initialize();


app.name = appName;

if (isWindows) {
  // in order to set the title on OS notifications on Windows, this needs to be set to app.name
  // https://github.com/mifi/lossless-cut/pull/2139
  // https://stackoverflow.com/a/65863174/6519037
  app.setAppUserModelId(app.name);
}

// https://www.electronjs.org/docs/latest/api/app#appsetaboutpaneloptionsoptions
app.setAboutPanelOptions(getAboutPanelOptions());

let filesToOpen: string[] = [];

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | null;

let askBeforeClose = false;
let rendererReady = false;
let newVersion: string | undefined;
let disableNetworking: boolean;

const openFiles = (paths: string[]) => mainWindow!.webContents.send('openFiles', paths);

let apiActionRequestsId = 0;
const apiActionRequests = new Map<number, () => void>();

async function sendApiAction(action: string, args?: unknown[]) {
  try {
    const id = apiActionRequestsId;
    apiActionRequestsId += 1;
    mainWindow!.webContents.send('apiAction', { id, action, args } satisfies ApiActionRequest);
    await new Promise<void>((resolve) => {
      apiActionRequests.set(id, resolve);
    });
  } catch (err) {
    logger.error('sendApiAction', err);
  }
}

// https://github.com/electron/electron/issues/526#issuecomment-563010533
function getSizeOptions() {
  const bounds = configStore.get('windowBounds');
  const options: BrowserWindowConstructorOptions = {};
  if (bounds) {
    const area = electron.screen.getDisplayMatching(bounds).workArea;
    // If the saved position still valid (the window is entirely inside the display area), use it.
    if (
      bounds.x >= area.x
      && bounds.y >= area.y
      && bounds.x + bounds.width <= area.x + area.width
      && bounds.y + bounds.height <= area.y + area.height
    ) {
      options.x = bounds.x;
      options.y = bounds.y;
    }
    // If the saved size is still valid, use it.
    if (bounds.width <= area.width || bounds.height <= area.height) {
      options.width = bounds.width;
      options.height = bounds.height;
    }
  }
  return options;
}

function createWindow() {
  const darkMode = configStore.get('darkMode');
  // todo follow darkMode setting when user switches
  // https://www.electronjs.org/docs/latest/tutorial/dark-mode
  if (darkMode) nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    ...getSizeOptions(),
    darkTheme: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      // https://github.com/electron/electron/issues/5107
      webSecurity: !isDev,
    },
    backgroundColor: darkMode ? '#333' : '#fff',
  });

  remote.enable(mainWindow.webContents);

  attachContextMenu(mainWindow);

  if (isDev) mainWindow.loadURL('http://localhost:3001');
  // Need to useloadFile for special characters https://github.com/mifi/lossless-cut/issues/40
  else mainWindow.loadFile('out/renderer/index.html');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // https://stackoverflow.com/questions/39574636/prompt-to-save-quit-before-closing-window/47434365
  mainWindow.on('close', (e) => {
    if (!askBeforeClose) return;

    assert(mainWindow);
    const choice = electron.dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: i18n.t('Confirm quit'),
      message: i18n.t('Are you sure you want to quit?'),
    });
    if (choice === 1) {
      e.preventDefault();
    }
  });

  const debouncedSaveWindowState = debounce(() => {
    if (!mainWindow) return;
    const { x, y, width, height } = mainWindow.getNormalBounds();
    configStore.set('windowBounds', { x, y, width, height });
  }, 500);

  mainWindow.on('resize', debouncedSaveWindowState);
  mainWindow.on('move', debouncedSaveWindowState);
}

function updateMenu() {
  assert(mainWindow);
  menu({ app, mainWindow, newVersion, isStoreBuild });
}

function openFilesEventually(paths: string[]) {
  if (rendererReady) openFiles(paths);
  else filesToOpen = paths;
}

// https://github.com/electron/electron/issues/3657
// https://github.com/mifi/lossless-cut/issues/357
// https://github.com/mifi/lossless-cut/issues/639
// https://github.com/mifi/lossless-cut/issues/591
function parseCliArgs(rawArgv = process.argv) {
  const ignoreFirstArgs = process.defaultApp ? 2 : 1;
  // production: First arg is the LosslessCut executable
  // dev: First 2 args are electron and the index.js
  const argsWithoutAppName = rawArgv.length > ignoreFirstArgs ? rawArgv.slice(ignoreFirstArgs) : [];

  return yargsParser(argsWithoutAppName, {
    boolean: ['allow-multiple-instances', 'disable-networking'],
    string: ['settings-json', 'config-dir'],
  });
}

const argv = parseCliArgs();

if (argv['localesPath'] != null) i18nCommon.setCustomLocalesPath(argv['localesPath']);


function safeRequestSingleInstanceLock(additionalData: Record<string, unknown>) {
  if (process.mas) return true; // todo remove when fixed https://github.com/electron/electron/issues/35540

  // using additionalData because the built in "argv" passing is a bit broken:
  // https://github.com/electron/electron/issues/20322
  return app.requestSingleInstanceLock(additionalData);
}

function initApp() {
  // On macOS, the system enforces single instance automatically when users try to open a second instance of your app in Finder, and the open-file and open-url events will be emitted for that.
  // However when users start your app in command line, the system's single instance mechanism will be bypassed, and you have to use this method to ensure single instance.
  // This can be tested with one terminal: npx electron .
  // and another terminal: npx electron . path/to/file.mp4
  app.on('second-instance', (_event, _commandLine, _workingDirectory, additionalData) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    if (!(additionalData != null && typeof additionalData === 'object' && 'argv' in additionalData) || !Array.isArray(additionalData.argv)) return;

    const argv2 = parseCliArgs(additionalData.argv);

    logger.info('second-instance', argv2);

    if (argv2._ && argv2._.length > 0) openFilesEventually(argv2._.map(String));
    else if (argv2['keyboardAction']) sendApiAction(argv2['keyboardAction']);
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
      createWindow();
    }
  });

  ipcMain.on('renderer-ready', () => {
    rendererReady = true;
    if (filesToOpen.length > 0) openFiles(filesToOpen);
  });

  // Mac OS open with LosslessCut
  // Emitted when the user wants to open a file with the application. The open-file event is usually emitted when the application is already open and the OS wants to reuse the application to open the file.
  app.on('open-file', (event, path) => {
    openFilesEventually([path]);
    event.preventDefault(); // recommended in docs https://www.electronjs.org/docs/latest/api/app#event-open-file-macos
  });

  ipcMain.on('setAskBeforeClose', (_e, val) => {
    askBeforeClose = val;
  });

  ipcMain.on('setLanguage', (_e, language) => {
    i18n.changeLanguage(language).then(() => updateMenu()).catch((err) => logger.error('Failed to set language', err));
  });

  ipcMain.handle('tryTrashItem', async (_e, path) => {
    try {
      await stat(path);
    } catch (err) {
      // @ts-expect-error todo
      if (err.code === 'ENOENT') return;
    }
    await shell.trashItem(path);
  });

  ipcMain.handle('showItemInFolder', (_e, path) => shell.showItemInFolder(path));

  ipcMain.on('apiActionResponse', (_e, { id }) => {
    apiActionRequests.get(id)?.();
  });
}


// This promise will be fulfilled when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Call this immediately, to make sure we don't miss it (race condition)
const readyPromise = app.whenReady();

// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
  try {
    logger.info('Initializing config store');
    await configStore.init({ customConfigDir: argv['configDir'] });

    const allowMultipleInstances = configStore.get('allowMultipleInstances');

    if (!allowMultipleInstances && !safeRequestSingleInstanceLock({ argv: process.argv })) {
      logger.info('Found running instance, quitting');
      app.quit();
      return;
    }

    initApp();

    logger.info('Waiting for app to become ready');
    await readyPromise;

    logger.info('CLI arguments', argv);
    // Only if no files to open already (open-file might have already added some files)
    if (filesToOpen.length === 0) filesToOpen = argv._.map(String);
    const { settingsJson } = argv;

    ({ disableNetworking } = argv);

    if (settingsJson != null) {
      logger.info('initializing settings', settingsJson);
      Object.entries(JSON5.parse(settingsJson)).forEach(([key, value]) => {
        // @ts-expect-error todo use zod?
        configStore.set(key, value);
      });
    }

    const { httpApi } = argv;

    if (httpApi != null) {
      const port = typeof httpApi === 'number' ? httpApi : 8080;
      const { startHttpServer } = HttpServer({ port, onKeyboardAction: sendApiAction });
      await startHttpServer();
      logger.info('HTTP API listening on port', port);
    }


    if (isDev) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-extraneous-dependencies
      const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');

      installExtension(REACT_DEVELOPER_TOOLS)
        .then((name: string) => logger.info('Added Extension', name))
        .catch((err: unknown) => logger.error('Failed to add extension', err));
    }

    createWindow();
    updateMenu();

    const enableUpdateCheck = configStore.get('enableUpdateCheck');

    if (!disableNetworking && enableUpdateCheck && !isStoreBuild) {
      newVersion = await checkNewVersion();
      // newVersion = '1.2.3';
      if (newVersion) updateMenu();
    }
  } catch (err) {
    logger.error('Failed to initialize', err);
  }
})();

export function focusWindow() {
  try {
    app.focus({ steal: true });
  } catch (err) {
    logger.error('Failed to focus window', err);
  }
}

export function quitApp() {
  // allow HTTP API to respond etc.
  timers.setTimeout(1000).then(() => electron.app.quit());
}

export const hasDisabledNetworking = () => !!disableNetworking;

export const setProgressBar = (v: number) => mainWindow?.setProgressBar(v);

export function sendOsNotification(options: NotificationConstructorOptions) {
  if (!Notification.isSupported()) return;
  const notification = new Notification(options);
  notification.on('failed', (_e, error) => logger.warn('Notification failed', error));
  notification.show();
}
