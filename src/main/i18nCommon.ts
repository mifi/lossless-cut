// intentionally disabled because I don't know the quality of the languages, so better to default to english
// const LanguageDetector = window.require('i18next-electron-language-detector');
// eslint-disable-next-line import/no-extraneous-dependencies
import { app } from 'electron';
import { join } from 'node:path';
import type { InitOptions } from 'i18next';

import type { SupportedLanguage } from '../common/i18n';
import { mapLang } from '../common/i18n';


let customLocalesPath: string | undefined;
export function setCustomLocalesPath(p: string) {
  customLocalesPath = p;
}

function getLangPath(subPath: string) {
  if (customLocalesPath != null) return join(customLocalesPath, subPath);
  if (app.isPackaged) return join(process.resourcesPath, 'locales', subPath);
  return join('locales', subPath);
}

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

export const loadPath = (lng: SupportedLanguage, ns: string) => getLangPath(`${mapLang(lng)}/${ns}.json`);
export const addPath = (lng: SupportedLanguage, ns: string) => getLangPath(`${mapLang(lng)}/${ns}.missing.json`);
