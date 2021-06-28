module.exports = {
  preset: 'ts-jest',
  testEnvironment: './jest.environment.js',
  testRunner: 'jest-circus/runner',
  testTimeout: 300000,
  verbose: true,
  setupFilesAfterEnv: ['./jest.setup.ts'],
  rootDir: '.',
  moduleNameMapper: {
    '^lib/(.*)$': '<rootDir>/../../lib/$1',
  },
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/tsconfig.json',
    },
  },
};
