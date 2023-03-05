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
      enabled: true,
      memoryLimit: 2048,
      profile: false,
      typescriptPath: require.resolve('typescript'),
    };
  });

  it('throws error if typescript is not installed', async () => {
    jest.setMock('typescript', undefined);

    const { assertTypeScriptSupport } = await import('src/typescript/type-script-support');

    expect(() => assertTypeScriptSupport(configuration)).toThrowError(
      'When you use ForkTsCheckerWebpackPlugin with typescript reporter enabled, you must install `typescript` package.'
    );
  });

  it('throws error if typescript version is lower then 3.6.0', async () => {
    jest.setMock('typescript', { version: '3.5.9' });

    const { assertTypeScriptSupport } = await import('src/typescript/type-script-support');

    expect(() => assertTypeScriptSupport(configuration)).toThrowError(
      [
        `ForkTsCheckerWebpackPlugin cannot use the current typescript version of 3.5.9.`,
        'The minimum required version is 3.6.0.',
      ].join(os.EOL)
    );
  });

  it("doesn't throw error if typescript version is greater or equal 3.6.0", async () => {
    jest.setMock('typescript', { version: '3.6.0' });
    jest.setMock('fs-extra', { existsSync: () => true });

    const { assertTypeScriptSupport } = await import('src/typescript/type-script-support');

    expect(() => assertTypeScriptSupport(configuration)).not.toThrowError();
  });

  it('throws error if there is no tsconfig.json file', async () => {
    jest.setMock('typescript', { version: '3.8.0' });
    jest.setMock('fs-extra', { existsSync: () => false });

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
