module.exports = {
  extends: [
    'airbnb',
    'airbnb/hooks',
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/stylistic',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  env: {
    node: true,
    browser: true,
  },
  rules: {
    'max-len': 0,
    'import/no-extraneous-dependencies': ['error', {
      devDependencies: true,
      optionalDependencies: false,
    }],
    'no-console': 0,
    'jsx-a11y/click-events-have-key-events': 0,
    'jsx-a11y/interactive-supports-focus': 0,
    'react/jsx-one-expression-per-line': 0,
    'object-curly-newline': 0,
    'arrow-parens': 0,
    'jsx-a11y/control-has-associated-label': 0,
    'react/prop-types': 0,
    'no-multiple-empty-lines': ['error', { max: 2, maxBOF: 0, maxEOF: 0 }],
    'no-promise-executor-return': 0,
    'react/function-component-definition': 0,
    'no-constant-binary-expression': 'error',
    '@typescript-eslint/no-var-requires': 0, // todo
    'react/display-name': 0, // todo
    '@typescript-eslint/no-unused-vars': 0, // todo
    'import/extensions': 0, // doesn't work with TS https://github.com/import-js/eslint-plugin-import/issues/2111
    'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
  },
  parserOptions: {
    ecmaVersion: 2022,
  },
};
