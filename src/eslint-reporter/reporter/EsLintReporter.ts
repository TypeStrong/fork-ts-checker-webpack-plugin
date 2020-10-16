// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CLIEngine, LintReport, LintResult } from '../types/eslint';
import { createIssuesFromEsLintResults } from '../issue/EsLintIssueFactory';
import { EsLintReporterConfiguration } from '../EsLintReporterConfiguration';
import { Reporter } from '../../reporter';
import minimatch from 'minimatch';

function createEsLintReporter(configuration: EsLintReporterConfiguration): Reporter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CLIEngine } = require('eslint');
  const engine: CLIEngine = new CLIEngine(configuration.options);

  let isInitialRun = true;
  const lintResults = new Map<string, LintResult>();
  const includedFilesPatterns = engine.resolveFileGlobPatterns(configuration.files);

  return {
    getReport: async ({ changedFiles = [], deletedFiles = [] }) => {
      return {
        async getDependencies() {
          return {
            files: [],
            dirs: [],
            extensions: [],
          };
        },
        async getIssues() {
          // cleanup old results
          changedFiles.forEach((changedFile) => {
            lintResults.delete(changedFile);
          });
          deletedFiles.forEach((removedFile) => {
            lintResults.delete(removedFile);
          });

          // get reports
          const lintReports: LintReport[] = [];

          if (isInitialRun) {
            lintReports.push(engine.executeOnFiles(includedFilesPatterns));
            isInitialRun = false;
          } else {
            // we need to take care to not lint files that are not included by the configuration.
            // the eslint engine will not exclude them automatically
            const changedAndIncludedFiles = changedFiles.filter(
              (changedFile) =>
                includedFilesPatterns.some((includedFilesPattern) =>
                  minimatch(changedFile, includedFilesPattern)
                ) &&
                (configuration.options.extensions || []).some((extension) =>
                  changedFile.endsWith(extension)
                ) &&
                !engine.isPathIgnored(changedFile)
            );

            if (changedAndIncludedFiles.length) {
              lintReports.push(engine.executeOnFiles(changedAndIncludedFiles));
            }
          }

          // output fixes if `fix` option is provided
          if (configuration.options.fix) {
            await Promise.all(lintReports.map((lintReport) => CLIEngine.outputFixes(lintReport)));
          }

          // store results
          lintReports.forEach((lintReport) => {
            lintReport.results.forEach((lintResult) => {
              lintResults.set(lintResult.filePath, lintResult);
            });
          });

          // get actual list of previous and current reports
          const results = Array.from(lintResults.values());

          return createIssuesFromEsLintResults(results);
        },
        async close() {
          // do nothing
        },
      };
    },
  };
}

export { createEsLintReporter };
