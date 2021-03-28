const i18n = require('i18next');
const Backend = require('i18next-fs-backend');

const { commonI18nOptions, loadPath, addPath } = require('./i18n-common');

// See also renderer

// https://github.com/i18next/i18next/issues/869
i18n
  .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  // TODO disabled for now because translations need more reviewing https://github.com/mifi/lossless-cut/issues/346
  // .use(LanguageDetector)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  // See also i18next-scanner.config.js
  .init({
    ...commonI18nOptions,

    backend: {
      loadPath,
      addPath,
    },
  });

module.exports = i18n;
