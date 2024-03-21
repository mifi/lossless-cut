// eslint-disable-line unicorn/filename-case
export default {
  input: ['src/renderer/**/*.{js,jsx,ts,tsx}', 'src/main/*.{js,ts}'],

  output: 'src/main/locales/$LOCALE/$NAMESPACE.json',
  indentation: 4,

  sort: true,

  locales: ['en'],

  lexers: {
    js: ['JavascriptLexer'],
    jsx: ['JsxLexer'],
  },

  defaultValue: (lng, ns, key) => key,

  // Keep in sync between i18next-parser.config.js and i18nCommon.js:
  keySeparator: false,
  namespaceSeparator: false,
};
