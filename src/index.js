const electron = require('electron'); // eslint-disable-line
const Configstore = require('configstore');
const bluebird = require('bluebird');
const which = bluebird.promisify(require('which'));

const menu = require('./menu');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const dialog = electron.dialog;
const configstore = new Configstore('lossless-cut');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    darkTheme: true,
  });
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

function showFfmpegDialog() {
  console.log('Show ffmpeg dialog');
  return new Promise(resolve => dialog.showOpenDialog({
    defaultPath: '/usr/local/bin/ffmpeg',
    properties: ['openFile', 'showHiddenFiles'],
  }, ffmpegPath => resolve(ffmpegPath !== undefined ? ffmpegPath[0] : undefined)));
}

function changeFfmpegPath() {
  return showFfmpegDialog()
    .then((ffmpegPath) => {
      if (ffmpegPath !== undefined) configstore.set('ffmpegPath', ffmpegPath);
    });
}

function configureFfmpeg() {
  return which('ffmpeg')
    .then(() => true)
    .catch(() => {
      if (configstore.get('ffmpegPath') !== undefined) {
        return undefined;
      }

      console.log('Show first time dialog');
      return new Promise(resolve => dialog.showMessageBox({
        buttons: ['OK'],
        message: 'This is the first time you run LosslessCut and ffmpeg path was not auto detected. Please close this dialog and then select the path to the ffmpeg executable.',
      }, resolve))
        .then(showFfmpegDialog)
        .then((ffmpegPath) => {
          configstore.set('ffmpegPath', ffmpegPath !== undefined ? ffmpegPath : '');
        });
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
  menu(app, mainWindow, changeFfmpegPath);
  configureFfmpeg();
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
