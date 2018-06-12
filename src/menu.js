const electron = require('electron'); // eslint-disable-line
const defaultMenu = require('electron-default-menu');

const Menu = electron.Menu;
const dialog = electron.dialog;

const homepage = 'https://github.com/mifi/lossless-cut';
const releasesPage = 'https://github.com/mifi/lossless-cut/releases';

module.exports = (app, mainWindow, newVersion) => {
  const menu = defaultMenu(app, electron.shell);

  const editMenuIndex = menu.findIndex(item => item.Label === 'Edit');
  if (editMenuIndex >= 0) menu.splice(editMenuIndex, 1);

  menu.splice((process.platform === 'darwin' ? 1 : 0), 0, {
    label: 'File',
    submenu: [
      {
        label: 'Open',
        accelerator: 'CmdOrCtrl+O',
        click() {
          dialog.showOpenDialog({ properties: ['openFile'] }, (filePaths) => {
            mainWindow.webContents.send('file-opened', filePaths);
          });
        },
      },
      {
        label: 'Convert to friendly format (fast)',
        click() {
          mainWindow.webContents.send('html5ify', false);
        },
      },
      {
        label: 'Convert to friendly codec (slow)',
        click() {
          mainWindow.webContents.send('html5ify', true);
        },
      },
    ],
  });

  const helpIndex = menu.findIndex(item => item.role === 'help');
  if (helpIndex >= 0) {
    menu.splice(helpIndex, 1, {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click() { electron.shell.openExternal(homepage); },
        },
      ],
    });
  }

  if (newVersion) {
    menu.push({
      label: 'New version!',
      submenu: [
        {
          label: `Download ${newVersion}`,
          click() { electron.shell.openExternal(releasesPage); },
        },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
};
