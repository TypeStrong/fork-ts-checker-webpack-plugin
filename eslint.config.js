const babelParser = require('@babel/eslint-parser');
const js = require('@eslint/js');
const importPlugin = require('eslint-plugin-import');
const nodePlugin = require('eslint-plugin-n');
const prettierPlugin = require('eslint-plugin-prettier');

// typescript-eslint needs TypeScript's classic compiler API, which TypeScript 7 doesn't have.
// Until it supports TypeScript 7, the files are parsed with Babel and there are no
// TypeScript-specific or type-aware rules.
// The code keeps its `eslint-disable` directives for typescript-eslint rules, and eslint
// reports a directive for a rule it doesn't know. This stands in for the plugin: every
// rule exists and reports nothing.
const typescriptEslintPlaceholder = {
  rules: new Proxy(
    {},
    {
      get: (rules, name) => (typeof name === 'string' ? { create: () => ({}) } : rules[name]),
    }
  ),
};

module.exports = [
  {
    ignores: ['lib/**', 'test/e2e/fixtures/**', '**/*.js'],
  },
  js.configs.recommended,
  nodePlugin.configs['flat/recommended'],
  {
    languageOptions: {
      parser: babelParser,
      sourceType: 'module',
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          parserOpts: { plugins: ['typescript'] },
        },
      },
    },
    linterOptions: {
      // the code still has directives for the typescript-eslint rules
      reportUnusedDisableDirectives: 'off',
    },
    plugins: {
      '@typescript-eslint': typescriptEslintPlaceholder,
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
        '@babel/eslint-parser': ['.ts'],
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.json', '.ts', '.d.ts'],
        },
      },
    },
    rules: {
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
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      // these rules don't understand types: the compiler reports undefined names,
      // and a name that is only used as a type would count as unused
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'n/no-unsupported-features/es-syntax': 'off',
      // the TypeScript compiler already reports unresolved imports, and
      // eslint-plugin-n does not resolve directory imports to index.ts
      'n/no-missing-import': 'off',
    },
  },
];
