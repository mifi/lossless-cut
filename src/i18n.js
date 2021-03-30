import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const { commonI18nOptions, fallbackLng, loadPath, addPath, Backend } = window.i18n;

export { fallbackLng };

// https://github.com/i18next/i18next/issues/869
i18n
  // TODO
  // .use(Backend)
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
