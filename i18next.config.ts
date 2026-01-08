// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'i18next-cli';

import type { SupportedLanguage } from './src/common/i18n.js';
import { langNames, mapLang } from './src/common/i18n.js';
import configBase from './i18next.config.base.js';

export default defineConfig({
  ...configBase,
  locales: Object.keys(langNames).map((lng) => mapLang(lng as SupportedLanguage)),
});
