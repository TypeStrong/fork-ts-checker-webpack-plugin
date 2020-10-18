module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  rootDir: '.',
  moduleNameMapper: {
    '^lib/(.*)$': '<rootDir>/../../lib/$1',
  },
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/../tsconfig.json',
    },
  },
};
