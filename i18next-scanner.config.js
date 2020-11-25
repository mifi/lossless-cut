// See also i18n.js
module.exports = {
  input: ['src/**/*.{js,jsx}'],
  output: './public',

  options: {
    // debug: true,
    defaultLng: 'en',
    func: {
      list: ['i18next.t', 'i18n.t', 't'],
    },

    defaultValue: (lng, ns, key) => key,
    resource: {
      loadPath: 'locales/{{lng}}/{{ns}}.json',
      savePath: 'locales/{{lng}}/{{ns}}.json',
      jsonIndent: 4,
    },
    nsSeparator: false,
    keySeparator: false,
    pluralSeparator: false,
    contextSeparator: false,

    trans: {
      fallbackKey: (ns, value) => value,
    },
  },
};
