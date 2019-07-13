module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    sourceType: 'module'
  },
  rules: {
    '@typescript-eslint/array-type': 'error'
  }
};
