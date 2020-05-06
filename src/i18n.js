import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// const LanguageDetector = window.require('i18next-electron-language-detector');
const Backend = window.require('i18next-fs-backend');
const isDev = window.require('electron-is-dev');

const { app } = window.require('electron').remote;

const { join } = require('path');

const getLangPath = (subPath) => (isDev ? join('public', subPath) : join(app.getAppPath(), 'build', subPath));

// Weblate hardcodes different lang codes than electron
// https://www.electronjs.org/docs/api/locales
const mapLang = (lng) => ({
  nb: 'nb_NO',
  no: 'nb_NO',
  nn: 'nb_NO',
  zh: 'zh_Hans',
  'zh-CN': 'zh_Hans',
  'zh-TW': 'zh_Hans',
  fr: 'fr',
  'fr-CA': 'fr',
  'fr-CH': 'fr',
  'fr-FR': 'fr',
  it: 'it',
  'it-CH': 'it',
  'it-IT': 'it',
}[lng] || lng);

export const fallbackLng = 'en';

// https://github.com/i18next/i18next/issues/869
i18n
  .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  // TODO disabled for now because translations need more reviewing https://github.com/mifi/lossless-cut/issues/346
  // .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  // See also i18next-scanner.config.js
  .init({
    fallbackLng,
    // debug: isDev,
    // saveMissing: isDev,
    // updateMissing: isDev,
    // saveMissingTo: 'all',

    // TODO improve keys?
    // Maybe do something like this: https://stackoverflow.com/a/19405314/6519037
    // https://www.i18next.com/translation-function/context
    keySeparator: false,
    nsSeparator: false,
    pluralSeparator: false,
    contextSeparator: false,

    backend: {
      loadPath: (lng, ns) => getLangPath(`locales/${mapLang(lng)}/${ns}.json`),
      addPath: (lng, ns) => getLangPath(`locales/${mapLang(lng)}/${ns}.missing.json`),
    },

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
  });

export default i18n;
