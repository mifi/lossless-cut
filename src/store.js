const Store = window.require('electron-store');

export default new Store({
  defaults: {
    captureFormat: 'jpeg',
    customOutDir: undefined,
    keyframeCut: true,
    autoMerge: false,
    timecodeShowFrames: false,
    invertCutSegments: false,
    autoExportExtraStreams: true,
    askBeforeClose: false,
    muted: false,
    autoSaveProjectFile: true,
    wheelSensitivity: 0.2,
    language: undefined,
  },
});
