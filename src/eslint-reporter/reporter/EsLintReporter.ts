import { LintReport } from '../types/eslint';
import { createEsLintReporterState, EsLintReporterState } from './EsLintReporterState';
import { createIssuesFromEsLintResults } from '../issue/EsLintIssueFactory';
import { EsLintReporterConfiguration } from '../EsLintReporterConfiguration';
import { Reporter } from '../../reporter';

function createEsLintReporter(configuration: EsLintReporterConfiguration): Reporter {
  const state: EsLintReporterState = createEsLintReporterState();
  return {
    getReport: async ({ createdFiles = [], changedFiles = [], deletedFiles = [] }) => {
      if (!state.engine) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { CLIEngine } = require('eslint');

        state.engine = new CLIEngine(configuration.options);
      }

      createdFiles.forEach((createdFile) => {
        state.lintResults.delete(createdFile);
      });
      changedFiles.forEach((changedFile) => {
        state.lintResults.delete(changedFile);
      });
      deletedFiles.forEach((removedFile) => {
        state.lintResults.delete(removedFile);
      });

      if (!state.engine) {
        throw new Error('Assert error - state.engine should be defined');
      }

      // get reports
      const lintReports: LintReport[] = [];
      if (state.isInitialRun) {
        lintReports.push(
          state.engine.executeOnFiles(state.engine.resolveFileGlobPatterns(configuration.files))
        );
        state.isInitialRun = false;
      }

      if (changedFiles.length) {
        lintReports.push(state.engine.executeOnFiles(changedFiles));
      }

      // store results in the state
      lintReports.forEach((lintReport) => {
        lintReport.results.forEach((lintResult) => {
          state.lintResults.set(lintResult.filePath, lintResult);
        });
      });

      // get actual list of previous and current reports
      const results = Array.from(state.lintResults.values());

      return createIssuesFromEsLintResults(results);
    },
  };
}

export { createEsLintReporter };
