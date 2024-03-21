import i18n from 'i18next';
import Backend from 'i18next-fs-backend';

import { commonI18nOptions, loadPath, addPath } from './i18nCommon.js';

// See also renderer

// https://github.com/i18next/i18next/issues/869
export default i18n
  .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  // TODO disabled for now because translations need more reviewing https://github.com/mifi/lossless-cut/issues/346
  // .use(LanguageDetector)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  // See also i18next-parser.config.mjs
  .init({
    ...commonI18nOptions,

    backend: {
      loadPath,
      addPath,
    },
  });
