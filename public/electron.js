const electron = require('electron');
const unhandled = require('electron-unhandled');
const i18n = require('i18next');
const { join } = require('path');

const menu = require('./menu');

const { checkNewVersion } = require('./update-checker');

const { isDev } = require('./util');

require('./i18n');

const { app, BrowserWindow } = electron;

unhandled({
  showDialog: true,
});

app.name = 'LosslessCut';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

let askBeforeClose = false;
let rendererReady = false;
let newVersion;

const openFiles = (paths) => mainWindow.webContents.send('file-opened', paths);
const openFile = (path) => openFiles([path]);

function createWindow() {
  mainWindow = new BrowserWindow({
    darkTheme: true,
    webPreferences: {
      nodeIntegration: true,
      // https://github.com/electron/electron/issues/5107
      webSecurity: !isDev,
      contextIsolation: true,
      preload: isDev ? join(__dirname, 'preload.js') : join(app.getAppPath(), 'preload.js'), // todo test production
    },
  });

  if (isDev) mainWindow.loadURL('http://localhost:3001');
  // Need to useloadFile for special characters https://github.com/mifi/lossless-cut/issues/40
  else mainWindow.loadFile('build/index.html');

  if (isDev) {
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer'); // eslint-disable-line global-require,import/no-extraneous-dependencies

    installExtension(REACT_DEVELOPER_TOOLS)
      .then(name => console.log(`Added Extension: ${name}`))
      .catch(err => console.log('An error occurred: ', err));
  }

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
}

function updateMenu() {
  menu(app, mainWindow, newVersion);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  createWindow();
  updateMenu();

  if (!process.windowsStore && !process.mas) {
    newVersion = await checkNewVersion();
    // newVersion = '1.2.3';
    if (newVersion) updateMenu();
  }
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

let openFileInitial;

electron.ipcMain.on('renderer-ready', () => {
  rendererReady = true;
  const ignoreFirstArgs = isDev ? 2 : 1;
  // production: First arg is the LosslessCut executable
  // dev: First 2 args are electron and the electron.js

  // https://github.com/electron/electron/issues/3657
  // https://github.com/mifi/lossless-cut/issues/357
  // https://github.com/mifi/lossless-cut/issues/639
  // https://github.com/mifi/lossless-cut/issues/591
  const filesToOpen = process.argv.length > ignoreFirstArgs
    ? process.argv.slice(ignoreFirstArgs).filter((arg) => arg && !arg.startsWith('-'))
    : [];

  if (filesToOpen.length > 0) openFiles(filesToOpen);
  else if (openFileInitial) openFile(openFileInitial);
});

// Mac OS open with LosslessCut
app.on('open-file', (event, path) => {
  if (rendererReady) openFile(path);
  else openFileInitial = path;
});

electron.ipcMain.on('setAskBeforeClose', (e, val) => {
  askBeforeClose = val;
});

electron.ipcMain.on('setLanguage', (e, language) => {
  i18n.changeLanguage(language).then(() => updateMenu()).catch(console.error);
});
