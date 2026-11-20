module.exports = {
  transform: {
    '^.+\\.tsx?$': ['@swc/jest', { jsc: { target: 'es2022' }, module: { type: 'commonjs' } }],
  },
  testEnvironment: './jest.environment.js',
  testTimeout: 300000,
  verbose: true,
  setupFilesAfterEnv: ['./jest.setup.ts'],
  rootDir: '.',
  moduleNameMapper: {
    '^lib/(.*)$': '<rootDir>/../../lib/$1',
  },
};
