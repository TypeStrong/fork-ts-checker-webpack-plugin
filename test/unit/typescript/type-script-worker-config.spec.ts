import path from 'path';

import type { TypeScriptWorkerConfig } from 'src/typescript/type-script-worker-config';
import type { TypeScriptWorkerOptions } from 'src/typescript/type-script-worker-options';
import type * as webpack from 'webpack';

describe('typescript/type-scripts-worker-config', () => {
  let compiler: webpack.Compiler;
  const context = '/webpack/context';

  const configuration: TypeScriptWorkerConfig = {
    memoryLimit: 2048,
    configFile: path.normalize(path.resolve(context, 'tsconfig.json')),
    configOverwrite: {},
    context: path.normalize(path.dirname(path.resolve(context, 'tsconfig.json'))),
    build: false,
    mode: 'readonly',
    diagnosticOptions: {
      semantic: true,
      syntactic: false,
      declaration: false,
      global: false,
    },
    profile: false,
    typescriptPath: require.resolve('typescript'),
  };

  const warn = jest.fn();

  beforeEach(() => {
    warn.mockReset();
    compiler = {
      options: {
        context,
      },
      getInfrastructureLogger: () => ({
        log: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn,
        info: jest.fn(),
      }),
    } as unknown as webpack.Compiler;
  });
  afterEach(() => {
    jest.resetModules();
  });

  it.each([
    [undefined, configuration],
    [{}, configuration],
    [{ memoryLimit: 512 }, { ...configuration, memoryLimit: 512 }],
    [
      { configFile: 'tsconfig.another.json' },
      {
        ...configuration,
        configFile: path.normalize(path.resolve(context, 'tsconfig.another.json')),
      },
    ],
    [{ build: true }, { ...configuration, build: true, mode: 'write-tsbuildinfo' }],
    [{ mode: 'readonly' }, { ...configuration, mode: 'readonly' }],
    [{ mode: 'write-dts' }, { ...configuration, mode: 'write-dts' }],
    [
      { build: true, mode: 'write-tsbuildinfo' },
      { ...configuration, build: true, mode: 'write-tsbuildinfo' },
    ],
    [
      { build: true, mode: 'write-references' },
      { ...configuration, build: true, mode: 'write-references' },
    ],
    [
      { configOverwrite: { compilerOptions: { strict: true }, include: ['src'] } },
      {
        ...configuration,
        configOverwrite: {
          compilerOptions: {
            strict: true,
          },
          include: ['src'],
        },
      },
    ],
    [{ diagnosticOptions: {} }, configuration],
    [
      { diagnosticOptions: { syntactic: true, semantic: false } },
      {
        ...configuration,
        diagnosticOptions: { semantic: false, syntactic: true, declaration: false, global: false },
      },
    ],
    [{ profile: true }, { ...configuration, profile: true }],
  ])('creates configuration from options %p', async (options, expectedConfig) => {
    const { createTypeScriptWorkerConfig } = await import(
      'src/typescript/type-script-worker-config'
    );
    const config = createTypeScriptWorkerConfig(compiler, options as TypeScriptWorkerOptions);

    expect(config).toEqual(expectedConfig);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(['write-tsbuildinfo', 'write-references'] as const)(
    'falls back to the readonly mode for %p without the build option',
    async (mode) => {
      const { createTypeScriptWorkerConfig } = await import(
        'src/typescript/type-script-worker-config'
      );
      const config = createTypeScriptWorkerConfig(compiler, { mode });

      expect(config).toEqual(configuration);
      expect(warn).toHaveBeenCalledWith(
        `The "${mode}" mode requires the "build" option - falling back to the "readonly" mode.`
      );
    }
  );
});
