const electron = require('electron');
const { t } = require('i18next');

// menu-safe i18n.t:
// https://github.com/mifi/lossless-cut/issues/1456
const esc = (val) => val.replace(/&/g, '&&');

const { Menu } = electron;

const { homepage, getReleaseUrl, licensesPage } = require('./constants');

module.exports = ({ app, mainWindow, newVersion, isStoreBuild }) => {
  const menu = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),

    {
      label: esc(t('File')),
      submenu: [
        {
          label: esc(t('Open')),
          accelerator: 'CmdOrCtrl+O',
          async click() {
            mainWindow.webContents.send('openFilesDialog');
          },
        },
        {
          label: esc(t('Close')),
          accelerator: 'CmdOrCtrl+W',
          async click() {
            mainWindow.webContents.send('closeCurrentFile');
          },
        },
        {
          label: esc(t('Close batch')),
          async click() {
            mainWindow.webContents.send('closeBatchFiles');
          },
        },
        { type: 'separator' },
        {
          label: esc(t('Import project (LLC)...')),
          click() {
            mainWindow.webContents.send('importEdlFile', 'llc');
          },
        },
        {
          label: esc(t('Export project (LLC)...')),
          click() {
            mainWindow.webContents.send('exportEdlFile', 'llc');
          },
        },
        {
          label: esc(t('Import project')),
          submenu: [
            {
              label: esc(t('Times in seconds (CSV)')),
              click() {
                mainWindow.webContents.send('importEdlFile', 'csv');
              },
            },
            {
              label: esc(t('Frame numbers (CSV)')),
              click() {
                mainWindow.webContents.send('importEdlFile', 'csv-frames');
              },
            },
            {
              label: esc(t('EDL (MPlayer)')),
              click() {
                mainWindow.webContents.send('importEdlFile', 'mplayer');
              },
            },
            {
              label: esc(t('Text chapters / YouTube')),
              click() {
                mainWindow.webContents.send('importEdlFile', 'youtube');
              },
            },
            {
              label: esc(t('DaVinci Resolve / Final Cut Pro XML')),
              click() {
                mainWindow.webContents.send('importEdlFile', 'xmeml');
              },
            },
            {
              label: esc(t('Final Cut Pro FCPX / FCPXML')),
              click() {
                mainWindow.webContents.send('importEdlFile', 'fcpxml');
              },
            },
            {
              label: esc(t('CUE sheet file')),
              click() {
                mainWindow.webContents.send('importEdlFile', 'cue');
              },
            },
            {
              label: esc(t('PotPlayer Bookmarks (.pbf)')),
              click() {
                mainWindow.webContents.send('importEdlFile', 'pbf');
              },
            },
          ],
        },
        {
          label: esc(t('Export project')),
          submenu: [
            {
              label: esc(t('Times in seconds (CSV)')),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'csv');
              },
            },
            {
              label: esc(t('Timestamps (CSV)')),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'csv-human');
              },
            },
            {
              label: esc(t('Frame numbers (CSV)')),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'csv-frames');
              },
            },
            {
              label: esc(t('Timestamps (TSV/TXT)')),
              click() {
                mainWindow.webContents.send('exportEdlFile', 'tsv-human');
              },
            },
            {
              label: esc(t('Start times as YouTube Chapters')),
              click() {
                mainWindow.webContents.send('exportEdlYouTube');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: esc(t('Convert to supported format')),
          click() {
            mainWindow.webContents.send('html5ify');
          },
        },
        {
          label: esc(t('Fix incorrect duration')),
          click() {
            mainWindow.webContents.send('fixInvalidDuration');
          },
        },
        { type: 'separator' },

        { type: 'separator' },
        {
          label: esc(t('Settings')),
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
            label: esc(t('Exit')),
            click() {
              app.quit();
            },
          },
        ] : []),
      ],
    },

    {
      label: esc(t('Edit')),
      submenu: [
        // https://github.com/mifi/lossless-cut/issues/610
        // https://github.com/mifi/lossless-cut/issues/1183
        { role: 'undo', label: esc(t('Undo')) },
        { role: 'redo', label: esc(t('Redo')) },
        { type: 'separator' },
        { role: 'cut', label: esc(t('Cut')) },
        { role: 'copy', label: esc(t('Copy')) },
        { role: 'paste', label: esc(t('Paste')) },
        { role: 'selectall', label: esc(t('Select All')) },
        { type: 'separator' },
        {
          label: esc(t('Segments')),
          submenu: [
            {
              label: esc(t('Clear all segments')),
              click() {
                mainWindow.webContents.send('clearSegments');
              },
            },
            {
              label: esc(t('Reorder segments by start time')),
              click() {
                mainWindow.webContents.send('reorderSegsByStartTime');
              },
            },
            {
              label: esc(t('Create num segments')),
              click() {
                mainWindow.webContents.send('createNumSegments');
              },
            },
            {
              label: esc(t('Create fixed duration segments')),
              click() {
                mainWindow.webContents.send('createFixedDurationSegments');
              },
            },
            {
              label: esc(t('Create random segments')),
              click() {
                mainWindow.webContents.send('createRandomSegments');
              },
            },
            {
              label: esc(t('Invert all segments on timeline')),
              click() {
                mainWindow.webContents.send('invertAllSegments');
              },
            },
            {
              label: esc(t('Fill gaps between segments')),
              click() {
                mainWindow.webContents.send('fillSegmentsGaps');
              },
            },
            {
              label: esc(t('Combine overlapping segments')),
              click() {
                mainWindow.webContents.send('combineOverlappingSegments');
              },
            },
            {
              label: esc(t('Combine selected segments')),
              click() {
                mainWindow.webContents.send('combineSelectedSegments');
              },
            },
            {
              label: esc(t('Shuffle segments order')),
              click() {
                mainWindow.webContents.send('shuffleSegments');
              },
            },
            {
              label: esc(t('Shift all segments on timeline')),
              click() {
                mainWindow.webContents.send('shiftAllSegmentTimes');
              },
            },
            {
              label: esc(t('Align segment times to keyframes')),
              click() {
                mainWindow.webContents.send('alignSegmentTimesToKeyframes');
              },
            },
          ],
        },
        {
          label: esc(t('Tracks')),
          submenu: [
            {
              label: esc(t('Extract all tracks')),
              click() {
                mainWindow.webContents.send('extractAllStreams');
              },
            },
            {
              label: esc(t('Edit tracks / metadata tags')),
              click() {
                mainWindow.webContents.send('showStreamsSelector');
              },
            },
          ],
        },
      ],
    },

    {
      label: esc(t('View')),
      submenu: [
        { role: 'togglefullscreen', label: esc(t('Toggle Full Screen')) },
      ],
    },

    // On Windows the windowMenu has a close Ctrl+W which clashes with File->Close shortcut
    ...(process.platform === 'darwin'
      ? [{ role: 'windowMenu', label: esc(t('Window')) }]
      : [{
        label: esc(t('Window')),
        submenu: [{ role: 'minimize', label: esc(t('Minimize')) }],
      }]
    ),

    {
      label: esc(t('Tools')),
      submenu: [
        {
          label: esc(t('Merge/concatenate files')),
          click() {
            mainWindow.webContents.send('concatCurrentBatch');
          },
        },
        {
          label: esc(t('Set custom start offset/timecode')),
          click() {
            mainWindow.webContents.send('askSetStartTimeOffset');
          },
        },
        {
          label: esc(t('Detect black scenes')),
          click() {
            mainWindow.webContents.send('detectBlackScenes');
          },
        },
        {
          label: esc(t('Detect silent scenes')),
          click() {
            mainWindow.webContents.send('detectSilentScenes');
          },
        },
        {
          label: esc(t('Detect scene changes')),
          click() {
            mainWindow.webContents.send('detectSceneChanges');
          },
        },
        {
          label: esc(t('Create segments from keyframes')),
          click() {
            mainWindow.webContents.send('createSegmentsFromKeyframes');
          },
        },
        {
          label: esc(t('Last ffmpeg commands')),
          click() { mainWindow.webContents.send('toggleLastCommands'); },
        },
        { type: 'separator' },
        { role: 'toggleDevTools', label: esc(t('Toggle Developer Tools')) },
      ],
    },
    {
      role: 'help',
      label: esc(t('Help')),
      submenu: [
        {
          label: esc(t('How to use')),
          click() { electron.shell.openExternal('https://mifi.no/losslesscut/usage'); },
        },
        {
          label: esc(t('FAQ')),
          click() { electron.shell.openExternal('https://mifi.no/losslesscut/faq'); },
        },
        {
          label: esc(t('Troubleshooting')),
          click() { electron.shell.openExternal('https://mifi.no/losslesscut/troubleshooting'); },
        },
        {
          label: esc(t('Learn More')),
          click() { electron.shell.openExternal(homepage); },
        },
        {
          label: esc(t('Licenses')),
          click() { electron.shell.openExternal(licensesPage); },
        },
        { type: 'separator' },
        {
          label: esc(t('Keyboard & mouse shortcuts')),
          click() {
            mainWindow.webContents.send('toggleKeyboardShortcuts');
          },
        },
        {
          label: esc(t('Report an error')),
          click() { mainWindow.webContents.send('openSendReportDialog'); },
        },
        ...(process.platform !== 'darwin' ? [{ role: 'about', label: esc(t('About LosslessCut')) }] : []),
      ],
    },
  ];

  if (!isStoreBuild && newVersion) {
    menu.push({
      label: esc(t('New version!')),
      submenu: [
        {
          label: esc(t('Download {{version}}', { version: newVersion })),
          click() { electron.shell.openExternal(getReleaseUrl(newVersion)); },
        },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
};
