const electron = require('electron'); // eslint-disable-line

const { Menu } = electron;
const { dialog } = electron;

const { homepage, releasesPage } = require('./constants');

module.exports = (app, mainWindow, newVersion) => {
  const menu = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),

    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          async click() {
            const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
            if (canceled) return;
            mainWindow.webContents.send('file-opened', filePaths);
          },
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          async click() {
            mainWindow.webContents.send('close-file');
          },
        },
        { type: 'separator' },
        {
          label: 'Import CSV cut file',
          click() {
            mainWindow.webContents.send('importEdlFile');
          },
        },
        {
          label: 'Export CSV cut file',
          click() {
            mainWindow.webContents.send('exportEdlFile');
          },
        },
        { type: 'separator' },
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
        { type: 'separator' },
        {
          label: 'Extract all streams',
          click() {
            mainWindow.webContents.send('extract-all-streams', false);
          },
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click() {
            mainWindow.webContents.send('openSettings');
          },
        },
        { type: 'separator' },
        {
          label: 'Exit',
          click() {
            app.quit();
          },
        },
      ],
    },

    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click() {
            mainWindow.webContents.send('undo');
          },
        },
        {
          label: 'Redo',
          accelerator: 'Shift+CmdOrCtrl+Z',
          click() {
            mainWindow.webContents.send('redo');
          },
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' },
      ],
    },

    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
      ],
    },

    { role: 'windowMenu' },

    {
      label: 'Tools',
      submenu: [
        {
          label: 'Merge files',
          click() {
            mainWindow.webContents.send('show-merge-dialog', true);
          },
        },
        {
          label: 'Set custom start offset/timecode',
          click() {
            mainWindow.webContents.send('set-start-offset', true);
          },
        },
        { role: 'toggleDevTools' },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Help and shortcuts',
          click() {
            mainWindow.webContents.send('openHelp');
          },
        },
        {
          label: 'About',
          click() {
            mainWindow.webContents.send('openAbout');
          },
        },
        {
          label: 'Learn More',
          click() { electron.shell.openExternal(homepage); },
        },
      ],
    },
  ];

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
