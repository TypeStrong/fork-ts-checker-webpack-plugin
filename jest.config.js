module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./test/setup.ts'],
  rootDir: '.',
  moduleNameMapper: {
    '^lib/(.*)$': '<rootDir>/lib/$1',
  },
  globals: {
    'ts-jest': {
      tsConfig: './test/tsconfig.json',
    },
  },
};
