module.exports = {
  extends: ['mifi'],
  rules: {
    'no-console': 0,
    'jsx-a11y/click-events-have-key-events': 0,
    'jsx-a11y/interactive-supports-focus': 0,
    'jsx-a11y/control-has-associated-label': 0,
    'unicorn/prefer-node-protocol': 0, // todo
  },

  overrides: [
    {
      files: ['./src/renderer/**/*.{js,cjs,mjs,jsx,ts,tsx,mts}'],
      env: {
        node: false,
        browser: true,
      },
      rules: {
        'import/no-extraneous-dependencies': 0,
      },
    },
    {
      files: ['./src/preload/**/*.{js,cjs,jsx,ts,tsx}'],
      env: {
        browser: true,
      },
    },
    {
      files: ['./script/**/*.{js,cjs,mjs,jsx,ts,tsx,mts}', 'electron.vite.config.js'],
      rules: {
        'import/no-extraneous-dependencies': ['error', {
          devDependencies: true,
          optionalDependencies: false,
        }],
      },
    },
  ],
};
