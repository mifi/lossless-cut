const electron = require('electron');
const i18n = require('i18next');

// menu-safe i18n.t:
// https://github.com/mifi/lossless-cut/issues/1456
const t = (key) => i18n.t(key).replace(/&/g, '&&');

const { Menu } = electron;

const { homepage, getReleaseUrl, licensesPage } = require('./constants');

module.exports = (app, mainWindow, newVersion) => {
  const menu = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),

    {
      label: t('File'),
      submenu: [
        {
          label: t('Open'),
          accelerator: 'CmdOrCtrl+O',
          async click() {
            mainWindow.webContents.send('openFilesDialog');
          },
        },
        {
          label: t('Close'),
          accelerator: 'CmdOrCtrl+W',
          async click() {
            mainWindow.webContents.send('closeCurrentFile');
          },
        },
        {
          label: t('Close batch'),
          async click() {
            mainWindow.webContents.send('closeBatchFiles');
          },
        },
        { type: 'separator' },
        {
          label: t('Import project (LLC)...'),
          click() {
            mainWindow.webContents.send('importEdlFile', 'llc');
          },
        },
        {
          label: t('Export project (LLC)...'),
          click() {
            mainWindow.webContents.send('exportEdlFile', 'llc');
          },
        },
        {
          label: t('Import project'),
          submenu: [
            {
              label: t('Times in seconds (CSV)'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'csv');
              },
            },
            {
              label: t('Frame numbers (CSV)'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'csv-frames');
              },
            },
            {
              label: t('EDL (MPlayer)'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'mplayer');
              },
            },
            {
              label: t('Text chapters / YouTube'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'youtube');
              },
            },
            {
              label: t('DaVinci Resolve / Final Cut Pro XML'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'xmeml');
              },
            },
            {
              label: t('Final Cut Pro FCPX / FCPXML'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'fcpxml');
              },
            },
            {
              label: t('CUE sheet file'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'cue');
              },
            },
            {
              label: t('PotPlayer Bookmarks (.pbf)'),
              click() {
                mainWindow.webContents.send('importEdlFile', 'pbf');
              },
            },
          ],
        },
        {
          label: t('Export project'),
          submenu: [
            {
              label: t('Times in seconds (CSV)'),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'csv');
              },
            },
            {
              label: t('Timestamps (CSV)'),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'csv-human');
              },
            },
            {
              label: t('Frame numbers (CSV)'),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'csv-frames');
              },
            },
            {
              label: t('Timestamps (TSV/TXT)'),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'tsv-human');
              },
            },
            {
              label: t('Start times as YouTube Chapters'),
              click() {
                mainWindow.webContents.send('exportEdlYouTube');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: t('Convert to supported format'),
          click() {
            mainWindow.webContents.send('html5ify');
          },
        },
        {
          label: t('Fix incorrect duration'),
          click() {
            mainWindow.webContents.send('fixInvalidDuration');
          },
        },
        { type: 'separator' },

        { type: 'separator' },
        {
          label: t('Settings'),
          accelerator: 'CmdOrCtrl+,',
          click() {
            mainWindow.webContents.send('toggleSettings');
          },
        },
        // Due to Apple Review Guidelines, we cannot include an Exit menu item here
        // Apple has their own Quit from the app menu
        ...(process.platform !== 'darwin' ? [
          { type: 'separator' },
          {
            label: t('Exit'),
            click() {
              app.quit();
            },
          },
        ] : []),
      ],
    },

    {
      label: t('Edit'),
      submenu: [
        // https://github.com/mifi/lossless-cut/issues/610
        // https://github.com/mifi/lossless-cut/issues/1183
        { role: 'undo', label: t('Undo') },
        { role: 'redo', label: t('Redo') },
        { type: 'separator' },
        { role: 'cut', label: t('Cut') },
        { role: 'copy', label: t('Copy') },
        { role: 'paste', label: t('Paste') },
        { role: 'selectall', label: t('Select All') },
        { type: 'separator' },
        {
          label: t('Segments'),
          submenu: [
            {
              label: t('Clear all segments'),
              click() {
                mainWindow.webContents.send('clearSegments');
              },
            },
            {
              label: t('Reorder segments by start time'),
              click() {
                mainWindow.webContents.send('reorderSegsByStartTime');
              },
            },
            {
              label: t('Create num segments'),
              click() {
                mainWindow.webContents.send('createNumSegments');
              },
            },
            {
              label: t('Create fixed duration segments'),
              click() {
                mainWindow.webContents.send('createFixedDurationSegments');
              },
            },
            {
              label: t('Create random segments'),
              click() {
                mainWindow.webContents.send('createRandomSegments');
              },
            },
            {
              label: t('Invert all segments on timeline'),
              click() {
                mainWindow.webContents.send('invertAllSegments');
              },
            },
            {
              label: t('Fill gaps between segments'),
              click() {
                mainWindow.webContents.send('fillSegmentsGaps');
              },
            },
            {
              label: t('Combine overlapping segments'),
              click() {
                mainWindow.webContents.send('combineOverlappingSegments');
              },
            },
            {
              label: t('Shuffle segments order'),
              click() {
                mainWindow.webContents.send('shuffleSegments');
              },
            },
            {
              label: t('Shift all segments on timeline'),
              click() {
                mainWindow.webContents.send('shiftAllSegmentTimes');
              },
            },
            {
              label: t('Align segment times to keyframes'),
              click() {
                mainWindow.webContents.send('alignSegmentTimesToKeyframes');
              },
            },
          ],
        },
        {
          label: t('Tracks'),
          submenu: [
            {
              label: t('Extract all tracks'),
              click() {
                mainWindow.webContents.send('extractAllStreams');
              },
            },
            {
              label: t('Edit tracks / metadata tags'),
              click() {
                mainWindow.webContents.send('showStreamsSelector');
              },
            },
          ],
        },
      ],
    },

    {
      label: t('View'),
      submenu: [
        { role: 'togglefullscreen', label: t('Toggle Full Screen') },
      ],
    },

    // On Windows the windowMenu has a close Ctrl+W which clashes with File->Close shortcut
    ...(process.platform === 'darwin'
      ? [{ role: 'windowMenu', label: t('Window') }]
      : [{
        label: t('Window'),
        submenu: [{ role: 'minimize', label: t('Minimize') }],
      }]
    ),

    {
      label: t('Tools'),
      submenu: [
        {
          label: t('Merge/concatenate files'),
          click() {
            mainWindow.webContents.send('concatCurrentBatch');
          },
        },
        {
          label: t('Set custom start offset/timecode'),
          click() {
            mainWindow.webContents.send('askSetStartTimeOffset');
          },
        },
        {
          label: t('Detect black scenes'),
          click() {
            mainWindow.webContents.send('detectBlackScenes');
          },
        },
        {
          label: t('Detect silent scenes'),
          click() {
            mainWindow.webContents.send('detectSilentScenes');
          },
        },
        {
          label: t('Detect scene changes'),
          click() {
            mainWindow.webContents.send('detectSceneChanges');
          },
        },
        {
          label: t('Create segments from keyframes'),
          click() {
            mainWindow.webContents.send('createSegmentsFromKeyframes');
          },
        },
        {
          label: t('Last ffmpeg commands'),
          click() { mainWindow.webContents.send('toggleLastCommands'); },
        },
        { type: 'separator' },
        { role: 'toggleDevTools', label: t('Toggle Developer Tools') },
      ],
    },
    {
      role: 'help',
      label: t('Help'),
      submenu: [
        {
          label: t('How to use'),
          click() { electron.shell.openExternal('https://mifi.no/losslesscut/usage'); },
        },
        {
          label: t('FAQ'),
          click() { electron.shell.openExternal('https://mifi.no/losslesscut/faq'); },
        },
        {
          label: t('Troubleshooting'),
          click() { electron.shell.openExternal('https://mifi.no/losslesscut/troubleshooting'); },
        },
        {
          label: t('Learn More'),
          click() { electron.shell.openExternal(homepage); },
        },
        {
          label: t('Licenses'),
          click() { electron.shell.openExternal(licensesPage); },
        },
        { type: 'separator' },
        {
          label: t('Keyboard & mouse shortcuts'),
          click() {
            mainWindow.webContents.send('toggleKeyboardShortcuts');
          },
        },
        {
          label: t('Report an error'),
          click() { mainWindow.webContents.send('openSendReportDialog'); },
        },
        {
          label: t('Version'),
          click() { mainWindow.webContents.send('openAbout'); },
        },
      ],
    },
  ];

  if (newVersion) {
    menu.push({
      label: t('New version!'),
      submenu: [
        {
          label: t('Download {{version}}', { version: newVersion }),
          click() { electron.shell.openExternal(getReleaseUrl(newVersion)); },
        },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
};
