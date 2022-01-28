module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  rootDir: '.',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/../../src/$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/../tsconfig.json',
    },
  },
};
