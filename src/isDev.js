const { isDev } = window.require('@electron/remote').require('./electron');

export default isDev;
