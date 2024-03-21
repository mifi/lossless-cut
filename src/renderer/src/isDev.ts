const { isDev } = window.require('@electron/remote').require('./index.js');

export default isDev;
