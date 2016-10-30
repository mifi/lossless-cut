const electron = require('electron'); // eslint-disable-line
const defaultMenu = require('electron-default-menu');

const Menu = electron.Menu;
const dialog = electron.dialog;

const homepage = 'https://github.com/mifi/lossless-cut';

module.exports = (app, mainWindow, changeFfmpegPath) => {
  const menu = defaultMenu(app, electron.shell);

  menu.splice(1, 1);

  menu.splice(1, 0, {
    label: 'File',
    submenu: [
      {
        label: 'Open',
        accelerator: 'CmdOrCtrl+O',
        click() {
          dialog.showOpenDialog({ properties: ['openFile'] }, (data) => {
            mainWindow.webContents.send('file-opened', data);
          });
        },
      },
      {
        label: 'Change ffmpeg path',
        click: changeFfmpegPath,
      },
    ],
  });

  menu.splice(menu.findIndex(item => item.role === 'help'), 1, {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click() { electron.shell.openExternal(homepage); },
      },
    ],
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
};
