// eslint-disable-next-line import/no-extraneous-dependencies
import type { defineConfig } from 'i18next-cli';

const configBase: Parameters<typeof defineConfig>[0] = {
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
};

export default configBase;
