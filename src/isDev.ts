const { isDev }: { isDev: boolean } = window.require('@electron/remote').require('./electron');

export default isDev;
