// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CLIEngine, LintReport, LintResult } from '../types/eslint';
import { createIssuesFromEsLintResults } from '../issue/EsLintIssueFactory';
import { EsLintReporterConfiguration } from '../EsLintReporterConfiguration';
import { Reporter } from '../../reporter';
import { normalize } from 'path';
import minimatch from 'minimatch';
import glob from 'glob';

function createEsLintReporter(configuration: EsLintReporterConfiguration): Reporter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CLIEngine } = require('eslint');
  const engine: CLIEngine = new CLIEngine(configuration.options);

  let isInitialRun = true;
  let isInitialGetFiles = true;

  const lintResults = new Map<string, LintResult>();
  const includedGlobPatterns = engine.resolveFileGlobPatterns(configuration.files);
  const includedFiles = new Set<string>();

  function isFileIncluded(path: string) {
    return (
      !path.includes('node_modules') &&
      includedGlobPatterns.some((pattern) => minimatch(path, pattern)) &&
      !engine.isPathIgnored(path)
    );
  }

  async function getFiles() {
    if (isInitialGetFiles) {
      isInitialGetFiles = false;

      const resolvedGlobs = await Promise.all(
        includedGlobPatterns.map(
          (globPattern) =>
            new Promise<string[]>((resolve) => {
              glob(globPattern, (error, resolvedFiles) => {
                if (error) {
                  // fail silently
                  resolve([]);
                } else {
                  resolve(resolvedFiles || []);
                }
              });
            })
        )
      );

      for (const resolvedGlob of resolvedGlobs) {
        for (const resolvedFile of resolvedGlob) {
          if (isFileIncluded(resolvedFile)) {
            includedFiles.add(resolvedFile);
          }
        }
      }
    }

    return Array.from(includedFiles);
  }

  function getDirs() {
    return includedGlobPatterns || [];
  }

  function getExtensions() {
    return configuration.options.extensions || [];
  }

  return {
    getReport: async ({ changedFiles = [], deletedFiles = [] }) => {
      return {
        async getDependencies() {
          for (const changedFile of changedFiles) {
            if (isFileIncluded(changedFile)) {
              includedFiles.add(changedFile);
            }
          }
          for (const deletedFile of deletedFiles) {
            includedFiles.delete(deletedFile);
          }

          return {
            files: (await getFiles()).map((file) => normalize(file)),
            dirs: getDirs().map((dir) => normalize(dir)),
            extensions: getExtensions(),
          };
        },
        async getIssues() {
          // cleanup old results
          for (const changedFile of changedFiles) {
            lintResults.delete(changedFile);
          }
          for (const deletedFile of deletedFiles) {
            lintResults.delete(deletedFile);
          }

          // get reports
          const lintReports: LintReport[] = [];

          if (isInitialRun) {
            lintReports.push(engine.executeOnFiles(includedGlobPatterns));
            isInitialRun = false;
          } else {
            // we need to take care to not lint files that are not included by the configuration.
            // the eslint engine will not exclude them automatically
            const changedAndIncludedFiles = changedFiles.filter((changedFile) =>
              isFileIncluded(changedFile)
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
          for (const lintReport of lintReports) {
            for (const lintResult of lintReport.results) {
              lintResults.set(lintResult.filePath, lintResult);
            }
          }

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
