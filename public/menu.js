const electron = require('electron'); // eslint-disable-line
const i18n = require('i18next');

const { Menu } = electron;
const { dialog } = electron;

const { homepage, getReleaseUrl, licensesPage } = require('./constants');

module.exports = (app, mainWindow, newVersion) => {
  const menu = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),

    {
      label: i18n.t('File'),
      submenu: [
        {
          label: i18n.t('Open'),
          accelerator: 'CmdOrCtrl+O',
          async click() {
            const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
            if (canceled) return;
            mainWindow.webContents.send('openFiles', filePaths);
          },
        },
        {
          label: i18n.t('Close'),
          accelerator: 'CmdOrCtrl+W',
          async click() {
            mainWindow.webContents.send('closeCurrentFile');
          },
        },
        {
          label: i18n.t('Close batch'),
          async click() {
            mainWindow.webContents.send('closeBatchFiles');
          },
        },
        { type: 'separator' },
        {
          label: i18n.t('Import project (LLC)...'),
          click() {
            mainWindow.webContents.send('importEdlFile', 'llc');
          },
        },
        {
          label: i18n.t('Export project (LLC)...'),
          click() {
            mainWindow.webContents.send('exportEdlFile', 'llc');
          },
        },
        {
          label: i18n.t('Import project'),
          submenu: [
            {
              label: i18n.t('Times in seconds (CSV)'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'csv');
              },
            },
            {
              label: i18n.t('Frame numbers (CSV)'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'csv-frames');
              },
            },
            {
              label: i18n.t('EDL (MPlayer)'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'mplayer');
              },
            },
            {
              label: i18n.t('Text chapters / YouTube'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'youtube');
              },
            },
            {
              label: i18n.t('DaVinci Resolve / Final Cut Pro XML'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'xmeml');
              },
            },
            {
              label: i18n.t('CUE sheet file'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'cue');
              },
            },
            {
              label: i18n.t('PotPlayer Bookmarks (.pbf)'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'pbf');
              },
            },
          ],
        },
        {
          label: i18n.t('Export project'),
          submenu: [
            {
              label: i18n.t('Times in seconds (CSV)'),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'csv');
              },
            },
            {
              label: i18n.t('Timestamps (CSV)'),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'csv-human');
              },
            },
            {
              label: i18n.t('Frame numbers (CSV)'),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'csv-frames');
              },
            },
            {
              label: i18n.t('Timestamps (TSV/TXT)'),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'tsv-human');
              },
            },
            {
              label: i18n.t('Start times as YouTube Chapters'),
              click() {
                mainWindow.webContents.send('exportEdlYouTube');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: i18n.t('Convert to supported format'),
          click() {
            mainWindow.webContents.send('html5ify');
          },
        },
        {
          label: i18n.t('Fix incorrect duration'),
          click() {
            mainWindow.webContents.send('fixInvalidDuration');
          },
        },
        { type: 'separator' },

        { type: 'separator' },
        {
          label: i18n.t('Settings'),
          accelerator: 'CmdOrCtrl+,',
          click() {
            mainWindow.webContents.send('toggleSettings');
          },
        },
        { type: 'separator' },
        {
          label: i18n.t('Exit'),
          click() {
            app.quit();
          },
        },
      ],
    },

    {
      label: i18n.t('Edit'),
      submenu: [
        { role: 'undo', label: i18n.t('Undo') },
        { role: 'redo', label: i18n.t('Redo') },
        { type: 'separator' },
        { role: 'cut', label: i18n.t('Cut') },
        { role: 'copy', label: i18n.t('Copy') },
        { role: 'paste', label: i18n.t('Paste') },
        { role: 'selectall', label: i18n.t('Select All') },
        { type: 'separator' },
        {
          label: i18n.t('Segments'),
          submenu: [
            {
              label: i18n.t('Clear all segments'),
              click() {
                mainWindow.webContents.send('clearSegments');
              },
            },
            {
              label: i18n.t('Reorder segments by start time'),
              click() {
                mainWindow.webContents.send('reorderSegsByStartTime');
              },
            },
            {
              label: i18n.t('Create num segments'),
              click() {
                mainWindow.webContents.send('createNumSegments');
              },
            },
            {
              label: i18n.t('Create fixed duration segments'),
              click() {
                mainWindow.webContents.send('createFixedDurationSegments');
              },
            },
            {
              label: i18n.t('Invert all segments on timeline'),
              click() {
                mainWindow.webContents.send('invertAllCutSegments');
              },
            },
            {
              label: i18n.t('Shuffle segments order'),
              click() {
                mainWindow.webContents.send('shuffleSegments');
              },
            },
            {
              label: i18n.t('Shift all segments on timeline'),
              click() {
                mainWindow.webContents.send('shiftAllSegmentTimes');
              },
            },
          ],
        },
        {
          label: i18n.t('Tracks'),
          submenu: [
            {
              label: i18n.t('Extract all tracks'),
              click() {
                mainWindow.webContents.send('extractAllStreams');
              },
            },
            {
              label: i18n.t('Edit tracks / metadata tags'),
              click() {
                mainWindow.webContents.send('showStreamsSelector');
              },
            },
          ],
        },
      ],
    },

    {
      label: i18n.t('View'),
      submenu: [
        { role: 'togglefullscreen', label: i18n.t('Toggle Full Screen') },
      ],
    },

    // On Windows the windowMenu has a close Ctrl+W which clashes with File->Close shortcut
    ...(process.platform === 'darwin'
      ? [{ role: 'windowMenu', label: i18n.t('Window') }]
      : [{
        label: i18n.t('Window'),
        submenu: [{ role: 'minimize', label: i18n.t('Minimize') }],
      }]
    ),

    {
      label: i18n.t('Tools'),
      submenu: [
        {
          label: i18n.t('Merge/concatenate files'),
          click() {
            mainWindow.webContents.send('concatCurrentBatch');
          },
        },
        {
          label: i18n.t('Set custom start offset/timecode'),
          click() {
            mainWindow.webContents.send('askSetStartTimeOffset');
          },
        },
        { role: 'toggleDevTools', label: i18n.t('Toggle Developer Tools') },
      ],
    },
    {
      role: 'help',
      label: i18n.t('Help'),
      submenu: [
        {
          label: i18n.t('Help and shortcuts'),
          click() {
            mainWindow.webContents.send('toggleHelp');
          },
        },
        {
          label: i18n.t('About'),
          click() {
            mainWindow.webContents.send('openAbout');
          },
        },
        {
          label: i18n.t('Licenses'),
          click() { electron.shell.openExternal(licensesPage); },
        },
        {
          label: i18n.t('Learn More'),
          click() { electron.shell.openExternal(homepage); },
        },
        {
          label: i18n.t('Report an error'),
          click() { mainWindow.webContents.send('openSendReportDialog'); },
        },
      ],
    },
  ];

  if (newVersion) {
    menu.push({
      label: i18n.t('New version!'),
      submenu: [
        {
          label: i18n.t('Download {{version}}', { version: newVersion }),
          click() { electron.shell.openExternal(getReleaseUrl(newVersion)); },
        },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
};
