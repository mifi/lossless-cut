const electron = require('electron'); // eslint-disable-line
const defaultMenu = require('electron-default-menu');

const { Menu } = electron;
const { dialog } = electron;

const homepage = 'https://github.com/mifi/lossless-cut';
const releasesPage = 'https://github.com/mifi/lossless-cut/releases';

module.exports = (app, mainWindow, newVersion) => {
  const menu = defaultMenu(app, electron.shell);

  const fileMenu = {
    label: 'File',
    submenu: [
      {
        label: 'Open',
        accelerator: 'CmdOrCtrl+O',
        async click() {
          const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
          if (canceled) return;
          mainWindow.webContents.send('file-opened', filePaths);
        },
      },
      {
        label: 'Close',
        async click() {
          mainWindow.webContents.send('close-file');
        },
      },
      {
        label: 'Convert to friendly format (fastest)',
        click() {
          mainWindow.webContents.send('html5ify', 'fastest');
        },
      },
      {
        label: 'Convert to friendly format (fast)',
        click() {
          mainWindow.webContents.send('html5ify', 'fast');
        },
      },
      {
        label: 'Convert to friendly codec (slow)',
        click() {
          mainWindow.webContents.send('html5ify', 'slow');
        },
      },
      {
        label: 'Convert to friendly codec (slowest, audio)',
        click() {
          mainWindow.webContents.send('html5ify', 'slow-audio');
        },
      },
      {
        label: 'Extract all streams',
        click() {
          mainWindow.webContents.send('extract-all-streams', false);
        },
      },
      {
        label: 'Set custom start offset/timecode',
        click() {
          mainWindow.webContents.send('set-start-offset', true);
        },
      },
      {
        label: 'Exit',
        click() {
          app.quit();
        },
      },
    ],
  };

  menu.splice((process.platform === 'darwin' ? 1 : 0), 0, fileMenu);

  const helpIndex = menu.findIndex(item => item.role === 'help');
  if (helpIndex >= 0) {
    menu.splice(helpIndex, 1, {
      label: 'Tools',
      submenu: [
        {
          label: 'Merge files',
          click() {
            mainWindow.webContents.send('show-merge-dialog', true);
          },
        },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click() { electron.shell.openExternal(homepage); },
        },

        ...(process.platform === 'darwin' ? [] : [{ role: 'about' }]),
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
