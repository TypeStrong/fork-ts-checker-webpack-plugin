module.exports = {
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2018
  },
  env: {
    node: true,
    jest: true,
    es6: true
  },
  extends: [
    'plugin:@typescript-eslint/recommended' // Uses the recommended rules from the @typescript-eslint/eslint-plugin
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-var-requires': 'off'
  }
};
