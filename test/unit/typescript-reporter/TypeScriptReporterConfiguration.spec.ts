import webpack from 'webpack';
import unixify from 'unixify';
import { TypeScriptReporterConfiguration } from 'lib/typescript-reporter/TypeScriptReporterConfiguration';
import { TypeScriptReporterOptions } from 'lib/typescript-reporter/TypeScriptReporterOptions';

describe('typescript-reporter/TypeScriptsReporterConfiguration', () => {
  let compiler: webpack.Compiler;
  let createTypeScriptVueExtensionConfiguration: jest.Mock;

  const configuration: TypeScriptReporterConfiguration = {
    enabled: true,
    memoryLimit: 2048,
    tsconfig: '/webpack/context/tsconfig.json',
    build: false,
    mode: 'readonly',
    compilerOptions: {
      skipDefaultLibCheck: true,
      skipLibCheck: true,
    },
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
  };

  beforeEach(() => {
    compiler = {
      options: {
        context: '/webpack/context',
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
      { tsconfig: 'tsconfig.another.json' },
      { ...configuration, tsconfig: '/webpack/context/tsconfig.another.json' },
    ],
    [{ build: true }, { ...configuration, build: true }],
    [{ mode: 'write-tsbuildinfo' }, { ...configuration, mode: 'write-tsbuildinfo' }],
    [{ mode: 'write-references' }, { ...configuration, mode: 'write-references' }],
    [
      { compilerOptions: { strict: true } },
      {
        ...configuration,
        compilerOptions: { skipDefaultLibCheck: true, skipLibCheck: true, strict: true },
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
  ])('creates configuration from options %p', async (options, expectedConfiguration) => {
    const { createTypeScriptReporterConfiguration } = await import(
      'lib/typescript-reporter/TypeScriptReporterConfiguration'
    );
    const configuration = createTypeScriptReporterConfiguration(
      compiler,
      options as TypeScriptReporterOptions
    );

    expect({ ...configuration, tsconfig: unixify(configuration.tsconfig) }).toEqual(
      expectedConfiguration
    );
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
