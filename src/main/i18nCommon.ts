// intentionally disabled because I don't know the quality of the languages, so better to default to english
// const LanguageDetector = window.require('i18next-electron-language-detector');
// eslint-disable-next-line import/no-extraneous-dependencies
import { app } from 'electron';
import { join } from 'path';
import { InitOptions } from 'i18next';


let customLocalesPath: string | undefined;
export function setCustomLocalesPath(p: string) {
  customLocalesPath = p;
}

function getLangPath(subPath: string) {
  if (customLocalesPath != null) return join(customLocalesPath, subPath);
  if (app.isPackaged) return join(process.resourcesPath, 'locales', subPath);
  return join('locales', subPath);
}

// Weblate hardcodes different lang codes than electron
// https://www.electronjs.org/docs/api/app#appgetlocale
// https://source.chromium.org/chromium/chromium/src/+/master:ui/base/l10n/l10n_util.cc
const mapLang = (lng: string) => ({
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

export const fallbackLng = 'en';

export const commonI18nOptions: InitOptions = {
  fallbackLng,
  // debug: isDev,
  // saveMissing: isDev,
  // updateMissing: isDev,
  // saveMissingTo: 'all',

  // Keep in sync between i18next-parser.config.js and i18nCommon.js:
  // TODO improve keys?
  // Maybe do something like this: https://stackoverflow.com/a/19405314/6519037
  keySeparator: false,
  nsSeparator: false,
};

export const loadPath = (lng: string, ns: string) => getLangPath(`${mapLang(lng)}/${ns}.json`);
export const addPath = (lng: string, ns: string) => getLangPath(`${mapLang(lng)}/${ns}.missing.json`);
