const electron = require('electron'); // eslint-disable-line
const isDev = require('electron-is-dev');
const { join } = require('path');
const os = require('os');
const unhandled = require('electron-unhandled');

const menu = require('./menu');
const configStore = require('./configStore');

const { checkNewVersion } = require('./update-checker');

const { app } = electron;
const { BrowserWindow } = electron;


unhandled({
  showDialog: true,
});

app.name = 'LosslessCut';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

let askBeforeClose = false;
let rendererReady = false;

function openFile(path) {
  mainWindow.webContents.send('file-opened', [path]);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    darkTheme: true,
    webPreferences: {
      nodeIntegration: true,
      // https://github.com/electron/electron/issues/5107
      webSecurity: !isDev,
    },
  });

  mainWindow.loadURL(isDev ? 'http://localhost:3001' : `file://${join(__dirname, '../build/index.html')}`);

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
      title: 'Confirm quit',
      message: 'Are you sure you want to quit?',
    });
    if (choice === 1) {
      e.preventDefault();
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  await configStore.init();

  createWindow();
  menu(app, mainWindow);

  // process.windowsStore is not working. Waiting for fix: https://github.com/electron/electron/issues/18161
  // if (!process.windowsStore && !process.mas) {
  if (os.platform() !== 'win32' && !process.mas) {
    const newVersion = await checkNewVersion();
    if (newVersion) {
      menu(app, mainWindow, newVersion);
    }
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
  if (!isDev) {
    // Take the last argument, but ONLY if there is more than one argv (first one is the LosslessCut executable)
    const fileToOpen = process.argv.length > 1 && process.argv[process.argv.length - 1];
    // https://github.com/electron/electron/issues/3657
    // https://github.com/mifi/lossless-cut/issues/357
    if (fileToOpen && !fileToOpen.startsWith('-')) openFile(fileToOpen);
  }
  if (openFileInitial) openFile(openFileInitial);
});

app.on('open-file', (event, path) => {
  if (rendererReady) openFile(path);
  else openFileInitial = path;
});

electron.ipcMain.on('setAskBeforeClose', (e, val) => {
  askBeforeClose = val;
});

function focusWindow() {
  try {
    app.focus({ steal: true });
  } catch (err) {
    console.error('Failed to focus window', err);
  }
}

module.exports = { focusWindow };
