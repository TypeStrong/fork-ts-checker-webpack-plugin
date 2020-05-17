import { CLIEngineOptions } from './types/eslint';

type EsLintReporterOptions = {
  files: string | string[];
  enabled?: boolean;
  memoryLimit?: number;
  options?: CLIEngineOptions;
};

export { EsLintReporterOptions };
