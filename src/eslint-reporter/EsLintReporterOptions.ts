type EsLintReporterOptions = {
  files: string | string[];
  enabled?: boolean;
  memoryLimit?: number;
  // it's not typed because we don't want to have direct dependency to eslint from this plugin
  options?: object;
};

export { EsLintReporterOptions };
