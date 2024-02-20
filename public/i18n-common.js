// eslint-disable-line unicorn/filename-case
// intentionally disabled because I don't know the quality of the languages, so better to default to english
// const LanguageDetector = window.require('i18next-electron-language-detector');
const isDev = require('electron-is-dev');
// eslint-disable-next-line import/no-extraneous-dependencies
const { app } = require('electron');
const { join } = require('path');

const { frontendBuildDir } = require('./util');

let customLocalesPath;
function setCustomLocalesPath(p) {
  customLocalesPath = p;
}

function getLangPath(subPath) {
  if (customLocalesPath != null) return join(customLocalesPath, subPath);
  if (isDev) return join('public', subPath);
  return join(app.getAppPath(), frontendBuildDir, subPath);
}

// Weblate hardcodes different lang codes than electron
// https://www.electronjs.org/docs/api/app#appgetlocale
// https://source.chromium.org/chromium/chromium/src/+/master:ui/base/l10n/l10n_util.cc
const mapLang = (lng) => ({
  nb: 'nb_NO',
  no: 'nb_NO',
  zh: 'zh_Hans',
  // https://source.chromium.org/chromium/chromium/src/+/master:ui/base/l10n/l10n_util.cc;l=354
  'zh-CN': 'zh_Hans', // Chinese simplified (mainland China)
  'zh-TW': 'zh_Hant', // Chinese traditional (Taiwan)
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

  // Keep in sync between i18next-parser.config.js and i18n-common.js:
  // TODO improve keys?
  // Maybe do something like this: https://stackoverflow.com/a/19405314/6519037
  keySeparator: false,
  nsSeparator: false,
};

const loadPath = (lng, ns) => getLangPath(`locales/${mapLang(lng)}/${ns}.json`);
const addPath = (lng, ns) => getLangPath(`locales/${mapLang(lng)}/${ns}.missing.json`);

module.exports = {
  fallbackLng,
  loadPath,
  addPath,
  commonI18nOptions,
  setCustomLocalesPath,
};
