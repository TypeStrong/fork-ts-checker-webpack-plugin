import webpack from 'webpack';
import path from 'path';
import { TypeScriptReporterConfiguration } from 'lib/typescript-reporter/TypeScriptReporterConfiguration';
import { TypeScriptReporterOptions } from 'lib/typescript-reporter/TypeScriptReporterOptions';

describe('typescript-reporter/TypeScriptsReporterConfiguration', () => {
  let compiler: webpack.Compiler;
  let createTypeScriptVueExtensionConfiguration: jest.Mock;
  const context = '/webpack/context';

  const configuration: TypeScriptReporterConfiguration = {
    enabled: true,
    memoryLimit: 2048,
    configFile: path.normalize(path.resolve(context, 'tsconfig.json')),
    configOverwrite: {
      compilerOptions: {
        skipLibCheck: true,
        sourceMap: false,
        inlineSourceMap: false,
        declarationMap: false,
      },
    },
    context: path.normalize(path.dirname(path.resolve(context, 'tsconfig.json'))),
    build: false,
    mode: 'write-tsbuildinfo',
    diagnosticOptions: {
      semantic: true,
      syntactic: false,
      declaration: false,
      global: false,
    },
    extensions: {
      vue: {
        enabled: false,
        compiler: 'vue-template-compiler',
      },
    },
    profile: false,
    typescriptPath: require.resolve('typescript'),
  };

  beforeEach(() => {
    compiler = {
      options: {
        context,
      },
    } as webpack.Compiler;
    createTypeScriptVueExtensionConfiguration = jest.fn(() => ({
      enabled: false,
      compiler: 'vue-template-compiler',
    }));
    jest.setMock('lib/typescript-reporter/extension/vue/TypeScriptVueExtensionConfiguration', {
      createTypeScriptVueExtensionConfiguration,
    });
  });
  afterEach(() => {
    jest.resetModules();
  });

  it.each([
    [undefined, configuration],
    [{}, configuration],
    [true, configuration],
    [false, { ...configuration, enabled: false }],
    [{ enabled: false }, { ...configuration, enabled: false }],
    [{ memoryLimit: 512 }, { ...configuration, memoryLimit: 512 }],
    [
      { configFile: 'tsconfig.another.json' },
      {
        ...configuration,
        configFile: path.normalize(path.resolve(context, 'tsconfig.another.json')),
      },
    ],
    [{ build: true }, { ...configuration, build: true }],
    [{ mode: 'readonly' }, { ...configuration, mode: 'readonly' }],
    [{ mode: 'write-tsbuildinfo' }, { ...configuration, mode: 'write-tsbuildinfo' }],
    [{ mode: 'write-dts' }, { ...configuration, mode: 'write-dts' }],
    [{ mode: 'write-references' }, { ...configuration, mode: 'write-references' }],
    [
      { configOverwrite: { compilerOptions: { strict: true }, include: ['src'] } },
      {
        ...configuration,
        configOverwrite: {
          compilerOptions: {
            skipLibCheck: true,
            sourceMap: false,
            inlineSourceMap: false,
            declarationMap: false,
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
  ])('creates configuration from options %p', async (options, expectedConfiguration) => {
    const { createTypeScriptReporterConfiguration } = await import(
      'lib/typescript-reporter/TypeScriptReporterConfiguration'
    );
    const configuration = createTypeScriptReporterConfiguration(
      compiler,
      options as TypeScriptReporterOptions
    );

    expect(configuration).toEqual(expectedConfiguration);
  });

  it('passes vue options to the vue extension', async () => {
    createTypeScriptVueExtensionConfiguration.mockImplementation(
      () => 'returned from vue extension'
    );
    const { createTypeScriptReporterConfiguration } = await import(
      'lib/typescript-reporter/TypeScriptReporterConfiguration'
    );

    const vueOptions = {
      enabled: true,
      compiler: 'test-compiler',
    };

    const configuration = createTypeScriptReporterConfiguration(compiler, {
      extensions: { vue: vueOptions },
    });

    expect(createTypeScriptVueExtensionConfiguration).toHaveBeenCalledWith(vueOptions);
    expect(configuration.extensions.vue).toEqual('returned from vue extension');
  });
});
