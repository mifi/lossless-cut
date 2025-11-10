// intentionally disabled because I don't know the quality of the languages, so better to default to english
// const LanguageDetector = window.require('i18next-electron-language-detector');
// eslint-disable-next-line import/no-extraneous-dependencies
import { app } from 'electron';
import { join } from 'node:path';
import { InitOptions } from 'i18next';
import { ElectronLanguageKey, SupportedLanguage } from '../../types';


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
function mapLang(lng: ElectronLanguageKey) {
  const map: Partial<Record<ElectronLanguageKey, string>> = {
    'de-AT': 'de',
    'de-CH': 'de',
    'de-DE': 'de',
    'de-LI': 'de',

    'es-419': 'es',
    'es-AR': 'es',
    'es-CL': 'es',
    'es-CO': 'es',
    'es-CR': 'es',
    'es-ES': 'es',
    'es-HN': 'es',
    'es-MX': 'es',
    'es-PE': 'es',
    'es-US': 'es',
    'es-UY': 'es',
    'es-VE': 'es',

    'fr-CA': 'fr',
    'fr-CH': 'fr',
    'fr-FR': 'fr',

    nb: 'nb_NO',
    no: 'nb_NO',

    zh: 'zh_Hans',
    'zh-CN': 'zh_Hans',
    'zh-TW': 'zh_Hant',
    'zh-HK': 'zh_Hant',

    'pt-BR': 'pt_BR',
    'pt-PT': 'pt',

    'it-CH': 'it',
    'it-IT': 'it',
  };

  return map[lng] ?? lng;
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
