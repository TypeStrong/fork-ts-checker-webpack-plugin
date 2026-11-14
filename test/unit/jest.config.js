module.exports = {
  transform: {
    '^.+\\.[jt]sx?$': ['@swc/jest', { jsc: { target: 'es2022' }, module: { type: 'commonjs' } }],
  },
  // these dependencies are ES modules, which jest can only `require` on Node.js >= 24.9
  transformIgnorePatterns: ['/node_modules/(?!(chalk|chokidar|readdirp)/)'],
  testEnvironment: 'node',
  rootDir: '.',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/../../src/$1',
  },
};
