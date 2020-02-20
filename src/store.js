const Store = require('electron-store');

const store = new Store({
  defaults: {
    captureFormat: 'jpeg',
    customOutDir: undefined,
    keyframeCut: true,
    autoMerge: false,
    timecodeShowFrames: false,
    invertCutSegments: false,
    autoExportExtraStreams: true,
    askBeforeClose: true,
    muted: false,
    autoSaveProjectFile: true,
  },
});

module.exports = store;
