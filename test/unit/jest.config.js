const swc = ['@swc/jest', { jsc: { target: 'es2022' }, module: { type: 'commonjs' } }];

// ESM-only dependencies. Node loads them with require(), but Jest's module loader can't,
// so they're compiled to CommonJS for the unit tests.
const esmOnlyPackages = [
  '@babel/code-frame',
  '@babel/helper-validator-identifier',
  'chokidar',
  'js-tokens',
  'readdirp',
].join('|');

module.exports = {
  transform: {
    '^.+\\.tsx?$': swc,
    // Jest converts `/` for Windows in transformIgnorePatterns, but not in transform keys.
    [`/node_modules/(${esmOnlyPackages})/.+\\.js$`.replaceAll('/', '[\\\\/]')]: swc,
  },
  transformIgnorePatterns: [`/node_modules/(?!(${esmOnlyPackages})/)`],
  testEnvironment: 'node',
  rootDir: '.',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/../../src/$1',
  },
};
