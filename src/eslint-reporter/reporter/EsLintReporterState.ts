import { CLIEngine, LintResult } from '../types/eslint';

interface EsLintReporterState {
  engine: CLIEngine | undefined;
  lintResults: Map<string, LintResult>;
  isInitialRun: boolean;
}

function createEsLintReporterState(): EsLintReporterState {
  return {
    engine: undefined,
    lintResults: new Map<string, LintResult>(),
    isInitialRun: true,
  };
}

export { EsLintReporterState, createEsLintReporterState };
