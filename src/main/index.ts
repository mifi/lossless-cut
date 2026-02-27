process.traceDeprecation = true;
process.traceProcessWarnings = true;

/* eslint-disable import/first */
// eslint-disable-next-line import/no-extraneous-dependencies
import electron, { BrowserWindow, type BrowserWindowConstructorOptions, nativeTheme, shell, app, ipcMain, Notification, type NotificationConstructorOptions } from 'electron';
import i18n from 'i18next';
import debounce from 'lodash.debounce/index.js';
import yargsParser from 'yargs-parser';
import JSON5 from 'json5';
import remote from '@electron/remote/main/index.js';
import { stat } from 'node:fs/promises';
import assert from 'node:assert';
import timers from 'node:timers/promises';
import { z } from 'zod';
import { fileURLToPath, pathToFileURL } from 'node:url';
import electronUnhandled from 'electron-unhandled';
import { fileTypeFromFile } from 'file-type/node';
import type { Asyncify } from 'type-fest';
// eslint-disable-next-line import/no-extraneous-dependencies
import { installExtension, REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import mitt from 'mitt';

import logger from './logger.js';
import menu from './menu.js';
import * as configStore from './configStore.js';
import { isLinux, isWindows, isMac, platform, arch, pathExists } from './util.js';
import { appName } from './common.js';
import attachContextMenu from './contextMenu.js';
import HttpServer from './httpServer.js';
import isDev from './isDev.js';
import isStoreBuild from './isStoreBuild.js';
import { getAboutPanelOptions } from './aboutPanel.js';
import { checkNewVersion } from './updateChecker.js';
import * as i18nCommon from './i18nCommon.js';
import './i18n.js';
import type { ApiActionRequest } from '../common/types.js';
import * as ffmpeg from './ffmpeg.js';
import * as compatPlayer from './compatPlayer.js';
import { downloadMediaUrl } from './ffmpeg.js';


electronUnhandled({ showDialog: true, logger: (err) => logger.error('electron-unhandled', err) });

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
    await new Promise<void>((resolve) => apiActionRequests.set(id, resolve));
  } catch (err) {
    logger.error('sendApiAction', err);
  }
}

export type AppEvent = {
  eventName: 'export-complete',
  paths?: string[],
} | {
  eventName: 'export-start',
  path: string,
}

const appEventEmitter = mitt<{ appEvent: AppEvent }>();

ipcMain.on('appEvent', (_e, appEvent: AppEvent) => {
  appEventEmitter.emit('appEvent', appEvent);
});

async function onAwaitAppEvent(awaitEventName: string, signal: AbortSignal) {
  return new Promise<AppEvent>((resolve, reject) => {
    const handler = (appEvent: AppEvent) => {
      if (appEvent.eventName === awaitEventName) {
        appEventEmitter.off('appEvent', handler);
        resolve(appEvent);
      }
    };
    appEventEmitter.on('appEvent', handler);
    signal.addEventListener('abort', () => {
      appEventEmitter.off('appEvent', handler);
      reject(new Error('Aborted'));
    });
  });
}

// https://github.com/electron/electron/issues/526#issuecomment-563010533
function getSavedBounds() {
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
  return {
    options,
    isMaximized: bounds != null ? bounds.isMaximized : false,
  };
}

function createWindow() {
  const darkMode = configStore.get('darkMode');
  // todo follow darkMode setting when user switches
  // https://www.electronjs.org/docs/latest/tutorial/dark-mode
  if (darkMode) nativeTheme.themeSource = 'dark';

  const savedBounds = getSavedBounds();

  mainWindow = new BrowserWindow({
    ...savedBounds.options,
    darkTheme: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      // https://github.com/electron/electron/issues/5107
      webSecurity: !isDev,
      preload: fileURLToPath(new URL('../preload/index.cjs', import.meta.url)),
    },
    backgroundColor: darkMode ? '#333' : '#fff',
    minWidth: 300,
    minHeight: 300,
  });

  if (savedBounds.isMaximized) mainWindow.maximize();

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

  // TODO replace with `windowStatePersistence` in the future? https://github.com/electron/rfcs/pull/16
  const debouncedSaveWindowState = debounce(() => {
    if (!mainWindow || !configStore.get('storeWindowBounds')) return;
    const { x, y, width, height } = mainWindow.getNormalBounds();
    const isMaximized = mainWindow.isMaximized();
    configStore.set('windowBounds', { x, y, width, height, isMaximized });
  }, 500);

  mainWindow.on('maximize', debouncedSaveWindowState);
  mainWindow.on('unmaximize', debouncedSaveWindowState);
  mainWindow.on('resize', debouncedSaveWindowState);
  mainWindow.on('move', debouncedSaveWindowState);
}

function updateMenu() {
  assert(mainWindow);
  menu({ app, mainWindow, newVersion, isStoreBuild });
}

async function changeLanguage(language: string | null) {
  try {
    await i18n.changeLanguage(language ?? undefined);
    updateMenu();
    // https://www.electronjs.org/docs/latest/api/app#appsetaboutpaneloptionsoptions
    app.setAboutPanelOptions(getAboutPanelOptions());
  } catch (err) {
    logger.error('Failed to set language', err);
  }
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
    boolean: ['disable-networking'],
    string: ['settings-json', 'config-dir', 'lossy-mode'],
  });
}

const argv = parseCliArgs();

const lossyModeSchema = z.object({ videoEncoder: z.union([z.literal('libx264'), z.literal('libx265'), z.literal('libsvtav1')]) });
// eslint-disable-next-line prefer-destructuring
const lossyMode = argv['lossyMode'] ? lossyModeSchema.parse(JSON5.parse(argv['lossyMode'])) : undefined;

export type LossyMode = z.infer<typeof lossyModeSchema>;

if (argv['localesPath'] != null) i18nCommon.setCustomLocalesPath(argv['localesPath']);


function safeRequestSingleInstanceLock(additionalData: Record<string, unknown>) {
  if (process.mas) return true; // todo remove when dropping support for MacOS 13 https://github.com/electron/electron/issues/35540#issuecomment-2173130321

  // using additionalData because the built in "argv" passing is a bit broken:
  // https://github.com/electron/electron/issues/20322
  return app.requestSingleInstanceLock(additionalData);
}

// This promise will be fulfilled when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Call this immediately, to make sure we don't miss it (race condition)
const readyPromise = app.whenReady();

async function init() {
  try {
    logger.info('LosslessCut version', app.getVersion(), { isDev });
    await configStore.init({ customConfigDir: argv['configDir'] });
    logger.info('Initialized config store');

    const allowMultipleInstances = configStore.get('allowMultipleInstances');
    const language = configStore.get('language');

    if (!allowMultipleInstances && !safeRequestSingleInstanceLock({ argv: process.argv })) {
      logger.info('Found running instance, quitting');
      app.quit();
      return;
    }

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

      if (argv2['keyboardAction']) sendApiAction(argv2['keyboardAction'], argv2._.map((arg) => JSON.parse(String(arg))));
      else if (argv2._ && argv2._.length > 0) openFilesEventually(argv2._.map(String));
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

    ipcMain.on('setLanguage', (_e, newLanguage) => changeLanguage(newLanguage));

    ipcMain.handle('tryTrashItem', async (_e, path) => {
      try {
        await stat(path);
      } catch (err) {
        if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return;
      }
      await shell.trashItem(path);
    });

    ipcMain.handle('showItemInFolder', (_e, path) => shell.showItemInFolder(path));

    ipcMain.on('apiActionResponse', (_e, { id }) => {
      apiActionRequests.get(id)?.();
    });

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
      const { startHttpServer } = HttpServer({ port, onKeyboardAction: sendApiAction, onAwaitAppEvent });
      await startHttpServer();
      logger.info('HTTP API listening on port', port);
    }


    if (isDev) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-extraneous-dependencies
      installExtension(REACT_DEVELOPER_TOOLS)
        .then((extension) => logger.info('Added Extension', extension.name))
        .catch((err: unknown) => logger.error('Failed to add extension', err));
    }

    createWindow();
    // will also updateMenu and set about panel options
    await changeLanguage(language);

    const enableUpdateCheck = configStore.get('enableUpdateCheck');

    if (!disableNetworking && enableUpdateCheck && !isStoreBuild) {
      newVersion = await checkNewVersion();
      // newVersion = '1.2.3';
      if (newVersion) updateMenu();
    }
  } catch (err) {
    logger.error('Failed to initialize', err);
  }
}

function focusWindow() {
  try {
    app.focus({ steal: true });
  } catch (err) {
    logger.error('Failed to focus window', err);
  }
}

function quitApp() {
  // allow HTTP API to respond etc.
  timers.setTimeout(1000).then(() => electron.app.quit());
}

const hasDisabledNetworking = () => !!disableNetworking;

const setProgressBar = (v: number) => mainWindow?.setProgressBar(v);

function sendOsNotification(options: NotificationConstructorOptions) {
  if (!Notification.isSupported()) return;
  const notification = new Notification(options);
  notification.on('failed', (_e, error) => logger.warn('Notification failed', error));
  notification.show();
}

const remoteApi = {
  pathExists,
  downloadMediaUrl,
  fileTypeFromFile,
  focusWindow,
  quitApp,
  setProgressBar,
  sendOsNotification,
};

export type RemoteApi = typeof remoteApi;

export type RemoteRpcApi = {
  [K in keyof RemoteApi]: Asyncify<RemoteApi[K]>;
};

// using @electron/remote
const remoteApiLegacy = {
  ffmpeg,
  i18n: i18nCommon,
  compatPlayer,
  configStore,
  isLinux,
  isWindows,
  isMac,
  platform,
  arch,
  isDev,
  lossyMode,
  pathToFileURL,
  hasDisabledNetworking,
};

export type RemoteApiLegacy = typeof remoteApiLegacy;


// @ts-expect-error don't know how to type
app.addListener('remote-require', (event: { returnValue: RemoteApiLegacy }, _webContents: unknown, moduleName: string) => {
  if (moduleName === './index.js') {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = remoteApiLegacy;
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcMain.handle('__electron_rpc__', async (_event, method: keyof RemoteApi, args: any[]) => {
  const fn = remoteApi[method];
  assert(fn, `Unknown API method: ${method}`);
  // @ts-expect-error don't know how to type
  return fn(...args);
});

// cannot top level await because app.whenReady will hang forever
// eslint-disable-next-line unicorn/prefer-top-level-await
init();
