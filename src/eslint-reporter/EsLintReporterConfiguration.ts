import webpack from 'webpack';
import { EsLintReporterOptions } from './EsLintReporterOptions';
import { CLIEngineOptions } from './types/eslint';

interface EsLintReporterConfiguration {
  enabled: boolean;
  memoryLimit: number;
  options: CLIEngineOptions;
  files: string[];
  cwd: string;
}

function castToArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  } else if (!Array.isArray(value)) {
    return [value];
  } else {
    return value;
  }
}

function createEsLintReporterConfiguration(
  compiler: webpack.Compiler,
  options: EsLintReporterOptions | undefined
): EsLintReporterConfiguration {
  return {
    enabled: !!(options && options.enabled === true),
    memoryLimit: 2048,
    ...(typeof options === 'object' ? options : {}),
    files: typeof options === 'object' ? castToArray(options.files) : [],
    cwd: compiler.options.context || process.cwd(),
    options: {
      cwd: compiler.options.context || process.cwd(),
      extensions: ['.js', '.ts', '.tsx'],
      ...(typeof options === 'object' ? options.options || {} : {}),
    },
  };
}

export { EsLintReporterConfiguration, createEsLintReporterConfiguration };
