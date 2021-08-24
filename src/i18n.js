import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const Backend = window.require('i18next-fs-backend');

const electron = window.require('electron'); // eslint-disable-line

const { commonI18nOptions, fallbackLng, loadPath, addPath } = electron.remote.require('./i18n-common');

export { fallbackLng };

// https://github.com/i18next/i18next/issues/869
i18n
  .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  // LanguageDetector is disabled because many users are used to english, and I cannot guarantee the status of all the translations so it's best to default to engligh https://github.com/mifi/lossless-cut/issues/346
  // .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  // See also i18next-scanner.config.js
  .init({
    ...commonI18nOptions,

    backend: {
      loadPath,
      addPath,
    },

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
  });

export default i18n;
