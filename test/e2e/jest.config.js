module.exports = {
  testEnvironment: './jest.environment.js',
  testRunner: 'jest-circus/runner',
  testTimeout: 300000,
  verbose: true,
  setupFilesAfterEnv: ['./jest.setup.ts'],
  rootDir: '.',
  moduleNameMapper: {
    '^lib/(.*)$': '<rootDir>/../../lib/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};
