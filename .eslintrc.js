module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:node/recommended', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  settings: {
    node: {
      tryExtensions: ['.js', '.json', '.ts', '.d.ts']
    }
  },
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'prettier/@typescript-eslint'
      ],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
        'node/no-unsupported-features/es-syntax': 'off'
      }
    },
    {
      files: ['*.spec.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'node/no-missing-import': 'off'
      }
    }
  ]
};
