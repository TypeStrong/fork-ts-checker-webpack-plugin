import webpack from 'webpack';
import { EsLintReporterOptions } from './EsLintReporterOptions';

interface EsLintReporterConfiguration {
  enabled: boolean;
  memoryLimit: number;
  options: object;
  files: string[];
}

function createEsLintReporterConfiguration(
  compiler: webpack.Compiler,
  options: EsLintReporterOptions | undefined
): EsLintReporterConfiguration {
  return {
    enabled: !!(options && options.enabled === true),
    memoryLimit: 2048,
    files: [],
    ...(typeof options === 'object' ? options : {}),
    options: {
      cwd: compiler.options.context || process.cwd(),
      extensions: ['.js', '.ts', '.tsx'],
      ...(typeof options === 'object' ? options.options || {} : {}),
    },
  };
}

export { EsLintReporterConfiguration, createEsLintReporterConfiguration };
