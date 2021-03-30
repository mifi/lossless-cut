const { contextBridge, remote, ipcRenderer } = require('electron');
const { exists, unlink, writeFile, readFile } = require('fs-extra');
const { extname, parse, sep, join, normalize, resolve, isAbsolute } = require('path');
const strtok3 = require('strtok3');
const I18nBackend = require('i18next-fs-backend');
const execa = require('execa');

const { githubLink } = require('./constants');
const { commonI18nOptions, fallbackLng, loadPath, addPath } = require('./i18n-common');
const configStore = require('./configStore');

const preloadUtil = require('./preload/util');
const ffmpeg = require('./preload/ffmpeg');

async function initPreload() {
  await configStore.init();
}
contextBridge.exposeInMainWorld('init', { preload: initPreload });

contextBridge.exposeInMainWorld('constants', {
  isDev: !remote.app.isPackaged,
  githubLink,
});

contextBridge.exposeInMainWorld('util', preloadUtil);
contextBridge.exposeInMainWorld('ffmpeg', ffmpeg);


contextBridge.exposeInMainWorld('ipc', {
  onMessage: (event, fn) => ipcRenderer.on(event, (e, ...args) => fn(...args)),
  send: ipcRenderer.send,
});

contextBridge.exposeInMainWorld('fs', {
  exists,
  unlink,
  writeFile,
  readFile,
}); // TODO improve?

contextBridge.exposeInMainWorld('path', {
  extname, parse, sep, join, normalize, resolve, isAbsolute,
}); // TODO improve?

contextBridge.exposeInMainWorld('strtok3', strtok3); // TODO improve

// TODO improve
let backend;
// Because contextBridge doesn't handle classes
const BackendProxy = {
  type: 'backend',
  init: (services, backendOptions, i18nextOptions) => {
    if (!backend) backend = new I18nBackend(services, backendOptions, i18nextOptions);
  },
  read: (language, namespace, callback) => {
    backend.read(language, namespace, callback);
  },
  // only used in backends acting as cache layer
  save: (language, namespace, data, callback) => {
    backend.save(language, namespace, data, callback);
  },
  create: (languages, namespace, key, fallbackValue, callback) => {
    backend.create(languages, namespace, key, fallbackValue, callback);
  },
};

contextBridge.exposeInMainWorld('i18n', {
  commonI18nOptions, fallbackLng, loadPath, addPath, Backend: BackendProxy,
}); // TODO improve

contextBridge.exposeInMainWorld('clipboard', {
  writeText: remote.clipboard.writeText,
}); // TODO improve

contextBridge.exposeInMainWorld('configStore', {
  get: (key) => configStore.get(key),
  set: (key, val) => configStore.set(key, val),
});

contextBridge.exposeInMainWorld('execa', { execa });
