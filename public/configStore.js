const Store = require('electron-store');

const defaults = {
  defaults: {
    captureFormat: 'jpeg',
    customOutDir: undefined,
    keyframeCut: true,
    autoMerge: false,
    autoDeleteMergedSegments: true,
    timecodeShowFrames: false,
    invertCutSegments: false,
    autoExportExtraStreams: true,
    exportConfirmEnabled: true,
    askBeforeClose: false,
    enableAskForImportChapters: true,
    enableAskForFileOpenAction: true,
    muted: false,
    autoSaveProjectFile: true,
    wheelSensitivity: 0.2,
    language: undefined,
    ffmpegExperimental: false,
    preserveMovData: false,
    avoidNegativeTs: 'make_zero',
    hideNotifications: undefined,
    autoLoadTimecode: false,
  },
};


let store;

async function init() {
  for (let i = 0; i < 5; i += 1) {
    try {
      store = new Store(defaults);
      return;
    } catch (err) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 2000));
      console.error('Failed to create config store, retrying', err);
    }
  }

  throw new Error('Timed out while creating config store');
}

function get(key) {
  return store.get(key);
}

function set(key, val) {
  if (val === undefined) store.delete(key);
  else store.set(key, val);
}

module.exports = {
  init,
  get,
  set,
};
