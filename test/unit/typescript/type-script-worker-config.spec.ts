import path from 'path';

import schema from 'src/plugin-options.json';
import type { TypeScriptWorkerConfig } from 'src/typescript/type-script-worker-config';
import { TYPESCRIPT_WORKER_MODES } from 'src/typescript/type-script-worker-options';
import type { TypeScriptWorkerOptions } from 'src/typescript/type-script-worker-options';
import type * as webpack from 'webpack';

describe('typescript/type-scripts-worker-config', () => {
  let compiler: webpack.Compiler;
  const context = '/webpack/context';

  const configuration: TypeScriptWorkerConfig = {
    configFile: path.normalize(path.resolve(context, 'tsconfig.json')),
    configOverwrite: {},
    context: path.normalize(path.dirname(path.resolve(context, 'tsconfig.json'))),
    build: false,
    mode: 'in-memory',
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
    [
      { configFile: 'tsconfig.another.json' },
      {
        ...configuration,
        configFile: path.normalize(path.resolve(context, 'tsconfig.another.json')),
      },
    ],
    [{ build: true }, { ...configuration, build: true, mode: 'in-memory' }],
    [{ mode: 'in-memory' }, { ...configuration, mode: 'in-memory' }],
    [{ mode: 'write' }, { ...configuration, mode: 'write' }],
    [
      { build: true, mode: 'write' },
      { ...configuration, build: true, mode: 'write' },
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
    // the worker compares and joins paths, so `context` has to be absolute and normalized
    [{ context: 'packages/app' }, { ...configuration, context: path.resolve('packages/app') }],
    [{ context: context + path.sep }, { ...configuration, context: path.resolve(context) }],
  ])('creates configuration from options %p', async (options, expectedConfig) => {
    const { createTypeScriptWorkerConfig } =
      await import('src/typescript/type-script-worker-config');
    const config = createTypeScriptWorkerConfig(compiler, options as TypeScriptWorkerOptions);

    expect(config).toEqual(expectedConfig);
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts the same modes in the options schema and in the types', () => {
    expect(schema.definitions.TypeScriptOptions.properties.mode.enum).toEqual([
      ...TYPESCRIPT_WORKER_MODES,
    ]);
  });
});
