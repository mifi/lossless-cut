import i18n from 'i18next';
import Backend from 'i18next-fs-backend';
// eslint-disable-next-line import/no-extraneous-dependencies
import { app } from 'electron';

import { commonI18nOptions, loadPath, addPath } from './i18nCommon.js';

// See also renderer

// https://github.com/i18next/i18next/issues/869
export default await i18n
  .use(Backend)
  .use({ type: 'languageDetector', async: false, detect: () => app.getLocale() })
  // See also i18next.config.base.ts
  .init({
    ...commonI18nOptions,

    backend: {
      loadPath,
      addPath,
    },
  });
