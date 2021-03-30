// const LanguageDetector = require('i18next-electron-language-detector');
const { app } = require('electron');
const { join } = require('path');

const { isDev } = require('./util');

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
  'ru-RU': 'ru',
}[lng] || lng);

const fallbackLng = 'en';

const commonI18nOptions = {
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
};

const loadPath = (lng, ns) => getLangPath(`locales/${mapLang(lng)}/${ns}.json`);
const addPath = (lng, ns) => getLangPath(`locales/${mapLang(lng)}/${ns}.missing.json`);

module.exports = { fallbackLng, loadPath, addPath, commonI18nOptions };
