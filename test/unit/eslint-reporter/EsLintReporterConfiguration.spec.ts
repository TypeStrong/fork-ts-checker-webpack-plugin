import webpack from 'webpack';
import { join } from 'path';
import { EsLintReporterConfiguration } from '../../../lib/eslint-reporter/EsLintReporterConfiguration';
import { EsLintReporterOptions } from '../../../lib/eslint-reporter/EsLintReporterOptions';

describe('eslint-reporter/EsLintReporterConfiguration', () => {
  let compiler: webpack.Compiler;
  const context = '/webpack/context';

  const configuration: EsLintReporterConfiguration = {
    enabled: false,
    memoryLimit: 2048,
    options: {
      cwd: context,
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    files: [],
  };

  beforeEach(() => {
    compiler = {
      options: {
        context,
      },
    } as webpack.Compiler;
  });

  it.each([
    [undefined, configuration],
    [{}, configuration],
    [
      { files: 'src/**/*.{js,ts,tsx,jsx}' },
      {
        ...configuration,
        enabled: true,
        files: [join(context, 'src/**/*.{js,ts,tsx,jsx}')],
      },
    ],
    [{ files: [] }, configuration],
    [{ enabled: true }, { ...configuration, enabled: true }],
    [{ memoryLimit: 512 }, { ...configuration, memoryLimit: 512 }],
  ])('creates configuration from options %p', async (options, expectedConfiguration) => {
    const { createEsLintReporterConfiguration } = await import(
      'lib/eslint-reporter/EsLintReporterConfiguration'
    );
    const configuration = createEsLintReporterConfiguration(
      compiler,
      options as EsLintReporterOptions
    );

    expect(configuration).toEqual(expectedConfiguration);
  });
});
