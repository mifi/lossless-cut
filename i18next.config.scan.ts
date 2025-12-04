// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'i18next-cli';

import configBase from './i18next.config.base.js';


export default defineConfig({
  ...configBase,
  locales: ['en'],
});
