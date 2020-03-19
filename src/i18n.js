import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const LanguageDetector = window.require('i18next-electron-language-detector');
const Backend = window.require('i18next-node-fs-backend');
const isDev = window.require('electron-is-dev');

const { app } = window.require('electron').remote;

const { join } = require('path');

const getLangPath = (subPath) => (isDev ? join('public', subPath) : join(app.getAppPath(), 'build', subPath));

// https://github.com/i18next/i18next/issues/869
i18n
  .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    fallbackLng: 'en',
    debug: isDev,
    // saveMissing: isDev,
    // updateMissing: isDev,
    // saveMissingTo: 'all',

    // TODO improve keys?
    keySeparator: false,
    nsSeparator: false,
    pluralSeparator: false,
    contextSeparator: false,

    backend: {
      loadPath: getLangPath('locales/{{lng}}/{{ns}}.json'),
      addPath: getLangPath('locales/{{lng}}/{{ns}}.missing.json'),
    },

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
  });

export default i18n;
