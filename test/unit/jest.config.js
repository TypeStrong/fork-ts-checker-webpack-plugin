module.exports = {
  transform: {
    '^.+\\.tsx?$': ['@swc/jest', { jsc: { target: 'es2022' }, module: { type: 'commonjs' } }],
  },
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  rootDir: '.',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/../../src/$1',
  },
};
