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
          label: 'Load project (CSV)',
          click() {
            mainWindow.webContents.send('importEdlFile', 'csv');
          },
        },
        {
          label: 'Import project',
          submenu: [
            {
              label: 'Text chapters / YouTube',
              click() {
                mainWindow.webContents.send('importEdlFile', 'youtube');
              },
            },
            {
              label: 'DaVinci Resolve / Final Cut Pro XML',
              click() {
                mainWindow.webContents.send('importEdlFile', 'xmeml');
              },
            },
            {
              label: 'CUE sheet file',
              click() {
                mainWindow.webContents.send('importEdlFile', 'cue');
              },
            },
          ],
        },
        {
          label: 'Save project (CSV)',
          click() {
            mainWindow.webContents.send('exportEdlFile');
          },
        },
        { type: 'separator' },
        {
          label: 'Convert to supported format',
          click() {
            mainWindow.webContents.send('html5ify');
          },
        },
        {
          label: 'Fix incorrect duration',
          click() {
            mainWindow.webContents.send('fixInvalidDuration');
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
        { type: 'separator' },
        {
          label: 'Segments',
          submenu: [
            {
              label: 'Create num segments',
              click() {
                mainWindow.webContents.send('createNumSegments');
              },
            },
            {
              label: 'Create fixed duration segments',
              click() {
                mainWindow.webContents.send('createFixedDurationSegments');
              },
            },
          ],
        },
      ],
    },

    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
      ],
    },

    // On Windows the windowMenu has a close Ctrl+W which clashes with File->Close shortcut
    ...(process.platform === 'darwin'
      ? [{ role: 'windowMenu' }]
      : [{
        label: 'Window',
        submenu: [{ role: 'minimize' }],
      }]
    ),

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
          label: 'Batch convert to supported format',
          click() {
            mainWindow.webContents.send('batchConvertFriendlyFormat');
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
        {
          label: 'Report an error',
          click() { mainWindow.webContents.send('openSendReportDialog'); },
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
