module.exports = {
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  rootDir: '.',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/../../src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
};
