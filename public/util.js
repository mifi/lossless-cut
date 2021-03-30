const electron = require('electron');

// TODO?
const isDev = electron.remote ? !electron.remote.app.isPackaged : !electron.app.isPackaged;

module.exports = {
  isDev,
};
