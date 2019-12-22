module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:node/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  settings: {
    node: {
      tryExtensions: ['.js', '.json', '.ts', '.d.ts']
    }
  },
  rules: {
    'no-process-exit': 'off', // to investigate if we should throw an error instead of process.exit()
    'node/no-unsupported-features/es-builtins': 'off',
    'node/no-unsupported-features/es-syntax': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-namespace': 'off' // maybe we should consider enabling it in the future
  }
};
