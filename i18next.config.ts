// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'i18next-cli';

import { langNames, mapLang, SupportedLanguage } from './src/common/i18n.js';


export default defineConfig({
  locales: Object.keys(langNames).map((lng) => mapLang(lng as SupportedLanguage)),
  extract: {
    input: [
      'src/renderer/**/*.{ts,tsx}',
      'src/main/**/*.ts',
      'src/common/**/*.ts',
      'src/preload/**/*.ts',
    ],
    output: 'locales/{{language}}/{{namespace}}.json',
    defaultNS: 'translation',
    functions: [
      't',
      '*.t',
    ],
    transComponents: [
      'Trans',
    ],
    ignoredAttributes: ['data-testid', 'aria-label', 'role'],

    // Keep in sync between i18next-parser.config.js and i18nCommon.js:
    keySeparator: false,
    nsSeparator: false,
  },
  types: {
    input: [
      'locales/{{language}}/{{namespace}}.json',
    ],
    output: 'src/types/i18next.d.ts',
  },
});
