/// <reference types="electron-vite/node" />
process.traceDeprecation = true;
process.traceProcessWarnings = true;

/* eslint-disable import/first */
// eslint-disable-next-line import/no-extraneous-dependencies
import electron, { AboutPanelOptionsOptions, BrowserWindow, BrowserWindowConstructorOptions, nativeTheme, shell, app, ipcMain } from 'electron';
import unhandled from 'electron-unhandled';
import i18n from 'i18next';
import debounce from 'lodash/debounce';
import yargsParser from 'yargs-parser';
import JSON5 from 'json5';
import remote from '@electron/remote/main';
import { stat } from 'fs/promises';
import assert from 'assert';

import logger from './logger.js';
import menu from './menu.js';
import * as configStore from './configStore.js';
import { isLinux } from './util.js';
import attachContextMenu from './contextMenu.js';
import HttpServer from './httpServer.js';
import isDev from './isDev.js';

import { checkNewVersion } from './updateChecker.js';

import * as i18nCommon from './i18nCommon.js';

import './i18n.js';
import { ApiKeyboardActionRequest } from '../../types.js';

export * as ffmpeg from './ffmpeg.js';

export * as i18n from './i18nCommon.js';

export * as compatPlayer from './compatPlayer.js';

export * as configStore from './configStore.js';

export { isLinux, isWindows, isMac, platform } from './util.js';

export { pathToFileURL } from 'node:url';


// https://www.i18next.com/overview/typescript#argument-of-type-defaulttfuncreturn-is-not-assignable-to-parameter-of-type-xyz
// todo This should not be necessary anymore since v23.0.0
declare module 'i18next' {
  interface CustomTypeOptions {
    returnNull: false;
  }
}

// eslint-disable-next-line unicorn/prefer-export-from
export { isDev };

// https://chromestatus.com/feature/5748496434987008
// https://peter.sh/experiments/chromium-command-line-switches/
// https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/runtime_enabled_features.json5
app.commandLine.appendSwitch('enable-blink-features', 'AudioVideoTracks');

remote.initialize();

unhandled({
  showDialog: true,
});

const appName = 'LosslessCut';
const copyrightYear = 2024;

const appVersion = app.getVersion();

app.name = appName;

const isStoreBuild = process.windowsStore || process.mas;

const showVersion = !isStoreBuild;

const aboutPanelOptions: AboutPanelOptionsOptions = {
  applicationName: appName,
  copyright: `Copyright © ${copyrightYear} Mikael Finstad ❤️ 🇳🇴`,
  version: '', // not very useful (MacOS only, and same as applicationVersion)
};

// https://github.com/electron/electron/issues/18918
// https://github.com/mifi/lossless-cut/issues/1537
if (isLinux) {
  aboutPanelOptions.version = appVersion;
}
if (!showVersion) {
  // https://github.com/mifi/lossless-cut/issues/1882
  aboutPanelOptions.applicationVersion = `${process.windowsStore ? 'Microsoft Store' : 'App Store'} edition, based on GitHub v${appVersion}`;
}

// https://www.electronjs.org/docs/latest/api/app#appsetaboutpaneloptionsoptions
app.setAboutPanelOptions(aboutPanelOptions);

let filesToOpen: string[] = [];

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | null;

let askBeforeClose = false;
let rendererReady = false;
let newVersion: string | undefined;
let disableNetworking: boolean;

const openFiles = (paths: string[]) => mainWindow!.webContents.send('openFiles', paths);

let apiKeyboardActionRequestsId = 0;
const apiKeyboardActionRequests = new Map<number, () => void>();

async function sendApiKeyboardAction(action: string) {
  try {
    const id = apiKeyboardActionRequestsId;
    apiKeyboardActionRequestsId += 1;
    mainWindow!.webContents.send('apiKeyboardAction', { id, action } satisfies ApiKeyboardActionRequest);
    await new Promise<void>((resolve) => {
      apiKeyboardActionRequests.set(id, resolve);
    });
  } catch (err) {
    logger.error('sendApiKeyboardAction', err);
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
    else if (argv2['keyboardAction']) sendApiKeyboardAction(argv2['keyboardAction']);
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

  ipcMain.on('apiKeyboardActionResponse', (_e, { id }) => {
    apiKeyboardActionRequests.get(id)?.();
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
      const { startHttpServer } = HttpServer({ port, onKeyboardAction: sendApiKeyboardAction });
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
  electron.app.quit();
}

export const hasDisabledNetworking = () => !!disableNetworking;
