const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const nodePlugin = require('eslint-plugin-n');
const prettierPlugin = require('eslint-plugin-prettier');

module.exports = [
  {
    ignores: ['lib/**', 'test/e2e/fixtures/**', '**/*.js'],
  },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  nodePlugin.configs['flat/recommended'],
  {
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      import: importPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      n: {
        tryExtensions: ['.js', '.json', '.ts', '.d.ts'],
      },
      'import/extensions': ['.js', '.json', '.ts', '.d.ts'],
      'import/external-module-folders': ['node_modules', 'node_modules/@types'],
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts'],
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.json', '.ts', '.d.ts'],
        },
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-cycle': ['error'],
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      'n/no-unsupported-features/es-syntax': 'off',
      // the TypeScript compiler already reports unresolved imports, and
      // eslint-plugin-n does not resolve directory imports to index.ts
      'n/no-missing-import': 'off',
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
