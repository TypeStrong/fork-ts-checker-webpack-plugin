import os from 'os';

import type { TypeScriptWorkerConfig } from 'src/typescript/type-script-worker-config';

describe('typescript/type-script-support', () => {
  let configuration: TypeScriptWorkerConfig;

  beforeEach(() => {
    jest.resetModules();

    configuration = {
      configFile: './tsconfig.json',
      configOverwrite: {},
      context: '.',
      build: false,
      mode: 'readonly',
      diagnosticOptions: {
        declaration: false,
        global: true,
        semantic: true,
        syntactic: false,
      },
      memoryLimit: 2048,
      profile: false,
      typescriptPath: require.resolve('typescript'),
    };
  });

  it('throws error if typescript is not installed', async () => {
    jest.setMock('src/typescript/type-script-package', { getTypeScriptVersion: () => undefined });

    const { assertTypeScriptSupport } = await import('src/typescript/type-script-support');

    expect(() => assertTypeScriptSupport(configuration)).toThrowError(
      'When you use ForkTsCheckerWebpackPlugin with typescript reporter enabled, you must install `typescript` package.'
    );
  });

  it.each(['3.6.0', '5.9.3', '6.0.2', '7.0.0'])(
    'throws error if typescript version %s is lower than 7.1.0-beta',
    async (version) => {
      jest.setMock('src/typescript/type-script-package', { getTypeScriptVersion: () => version });

      const { assertTypeScriptSupport } = await import('src/typescript/type-script-support');

      expect(() => assertTypeScriptSupport(configuration)).toThrowError(
        [
          `ForkTsCheckerWebpackPlugin cannot use the current typescript version of ${version}.`,
          'The minimum required version is 7.1.0-beta.',
          'Use fork-ts-checker-webpack-plugin@9 for older TypeScript versions.',
        ].join(os.EOL)
      );
    }
  );

  it.each(['7.1.0-beta', '7.1.0-dev.20261113.1', '7.1.0', '7.2.0'])(
    "doesn't throw error if typescript version is %s",
    async (version) => {
      jest.setMock('src/typescript/type-script-package', { getTypeScriptVersion: () => version });
      jest.setMock('fs', { existsSync: () => true });

      const { assertTypeScriptSupport } = await import('src/typescript/type-script-support');

      expect(() => assertTypeScriptSupport(configuration)).not.toThrowError();
    }
  );

  it('throws error if there is no tsconfig.json file', async () => {
    jest.setMock('src/typescript/type-script-package', { getTypeScriptVersion: () => '7.1.0' });
    jest.setMock('fs', { existsSync: () => false });

    const { assertTypeScriptSupport } = await import('src/typescript/type-script-support');

    expect(() => assertTypeScriptSupport(configuration)).toThrowError(
      [
        `Cannot find the "./tsconfig.json" file.`,
        `Please check webpack and ForkTsCheckerWebpackPlugin configuration.`,
        `Possible errors:`,
        '  - wrong `context` directory in webpack configuration (if `configFile` is not set or is a relative path in the fork plugin configuration)',
        '  - wrong `typescript.configFile` path in the plugin configuration (should be a relative or absolute path)',
      ].join(os.EOL)
    );
  });
});
