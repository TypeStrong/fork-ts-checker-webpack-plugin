import { CLIEngine, LintReport, LintResult } from '../types/eslint';
import { createIssuesFromEsLintResults } from '../issue/EsLintIssueFactory';
import { EsLintReporterConfiguration } from '../EsLintReporterConfiguration';
import { Reporter } from '../../reporter';

function createEsLintReporter(configuration: EsLintReporterConfiguration): Reporter {
  let engine: CLIEngine;
  let isInitialRun = true;
  const lintResults = new Map<string, LintResult>();

  return {
    getReport: async ({ changedFiles = [], deletedFiles = [] }) => {
      if (!engine) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { CLIEngine } = require('eslint');

        engine = new CLIEngine(configuration.options);
        isInitialRun = true;
      }

      changedFiles.forEach((changedFile) => {
        lintResults.delete(changedFile);
      });
      deletedFiles.forEach((removedFile) => {
        lintResults.delete(removedFile);
      });

      // get reports
      const lintReports: LintReport[] = [];
      if (isInitialRun) {
        lintReports.push(
          engine.executeOnFiles(engine.resolveFileGlobPatterns(configuration.files))
        );
        isInitialRun = false;
      } else {
        if (changedFiles.length) {
          lintReports.push(engine.executeOnFiles(changedFiles));
        }
      }

      // store results in the state
      lintReports.forEach((lintReport) => {
        lintReport.results.forEach((lintResult) => {
          lintResults.set(lintResult.filePath, lintResult);
        });
      });

      // get actual list of previous and current reports
      const results = Array.from(lintResults.values());

      return createIssuesFromEsLintResults(results);
    },
  };
}

export { createEsLintReporter };
