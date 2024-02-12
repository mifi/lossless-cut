import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const Backend = window.require('i18next-fs-backend');

const remote = window.require('@electron/remote');

const { commonI18nOptions, fallbackLng, loadPath, addPath } = remote.require('./i18n-common');

// https://www.i18next.com/overview/typescript#argument-of-type-defaulttfuncreturn-is-not-assignable-to-parameter-of-type-xyz
// todo This should not be necessary anymore since v23.0.0
declare module 'i18next' {
  interface CustomTypeOptions {
    returnNull: false;
  }
}
export { fallbackLng };

// https://github.com/i18next/react-i18next/blob/master/example/react/src/i18n.js
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
  // See also i18next-parser.config.mjs
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
