const electron = require('electron'); // eslint-disable-line
const isDev = require('electron-is-dev');
const path = require('path');
const url = require('url');

const menu = require('./menu');

const { checkNewVersion } = require('./update-checker');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

app.setName('LosslessCut');

if (!isDev) process.env.NODE_ENV = 'production';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    darkTheme: true,
  });
  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  createWindow();
  menu(app, mainWindow);

  const newVersion = await checkNewVersion();
  if (newVersion) {
    menu(app, mainWindow, newVersion);
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

electron.ipcMain.on('renderer-ready', () => {
  if (!isDev) {
    const fileToOpen = process.argv[1];
    if (fileToOpen) mainWindow.webContents.send('file-opened', [fileToOpen]);
  }
});
