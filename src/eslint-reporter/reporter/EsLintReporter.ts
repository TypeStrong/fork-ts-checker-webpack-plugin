// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CLIEngine, ESLintOrCLIEngine, LintReport, LintResult } from '../types/eslint';
import { createIssuesFromEsLintResults } from '../issue/EsLintIssueFactory';
import { EsLintReporterConfiguration } from '../EsLintReporterConfiguration';
import { Reporter } from '../../reporter';
import path from 'path';
import fs from 'fs-extra';
import minimatch from 'minimatch';
import glob from 'glob';

const isOldCLIEngine = (eslint: ESLintOrCLIEngine): eslint is CLIEngine =>
  (eslint as CLIEngine).resolveFileGlobPatterns !== undefined;

function createEsLintReporter(configuration: EsLintReporterConfiguration): Reporter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CLIEngine, ESLint } = require('eslint');

  const eslint: ESLintOrCLIEngine = ESLint
    ? new ESLint(configuration.options)
    : new CLIEngine(configuration.options);

  let isInitialRun = true;
  let isInitialGetFiles = true;

  const lintResults = new Map<string, LintResult>();
  const includedGlobPatterns = resolveFileGlobPatterns(configuration.files);
  const includedFiles = new Set<string>();

  async function isFileIncluded(path: string): Promise<boolean> {
    return (
      !path.includes('node_modules') &&
      includedGlobPatterns.some((pattern) => minimatch(path, pattern)) &&
      !(await eslint.isPathIgnored(path))
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
          if (await isFileIncluded(resolvedFile)) {
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

  // Copied from the eslint 6 implementation, as it's not available in eslint 8
  function resolveFileGlobPatterns(globPatterns: string[]) {
    if (configuration.options.globInputPaths === false) {
      return globPatterns.filter(Boolean);
    }

    const extensions = getExtensions().map((ext) => ext.replace(/^\./u, ''));
    const dirSuffix = `/**/*.{${extensions.join(',')}}`;

    return globPatterns.filter(Boolean).map((globPattern) => {
      const resolvedPath = path.resolve(configuration.options.cwd || '', globPattern);
      const newPath = directoryExists(resolvedPath)
        ? globPattern.replace(/[/\\]$/u, '') + dirSuffix
        : globPattern;

      return path.normalize(newPath).replace(/\\/gu, '/');
    });
  }

  // Copied from the eslint 6 implementation, as it's not available in eslint 8
  function directoryExists(resolvedPath: string) {
    try {
      return fs.statSync(resolvedPath).isDirectory();
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  return {
    getReport: async ({ changedFiles = [], deletedFiles = [] }) => {
      return {
        async getDependencies() {
          for (const changedFile of changedFiles) {
            if (await isFileIncluded(changedFile)) {
              includedFiles.add(changedFile);
            }
          }
          for (const deletedFile of deletedFiles) {
            includedFiles.delete(deletedFile);
          }

          return {
            files: (await getFiles()).map((file) => path.normalize(file)),
            dirs: getDirs().map((dir) => path.normalize(dir)),
            excluded: [],
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
            const lintReport: LintReport = await (isOldCLIEngine(eslint)
              ? Promise.resolve(eslint.executeOnFiles(includedGlobPatterns))
              : eslint.lintFiles(includedGlobPatterns).then((results) => ({ results })));
            lintReports.push(lintReport);
            isInitialRun = false;
          } else {
            // we need to take care to not lint files that are not included by the configuration.
            // the eslint engine will not exclude them automatically
            const changedAndIncludedFiles: string[] = [];
            for (const changedFile of changedFiles) {
              if (await isFileIncluded(changedFile)) {
                changedAndIncludedFiles.push(changedFile);
              }
            }

            if (changedAndIncludedFiles.length) {
              const lintReport: LintReport = await (isOldCLIEngine(eslint)
                ? Promise.resolve(eslint.executeOnFiles(changedAndIncludedFiles))
                : eslint.lintFiles(changedAndIncludedFiles).then((results) => ({ results })));
              lintReports.push(lintReport);
            }
          }

          // output fixes if `fix` option is provided
          if (configuration.options.fix) {
            await Promise.all(
              lintReports.map((lintReport) =>
                isOldCLIEngine(eslint)
                  ? CLIEngine.outputFixes(lintReport)
                  : ESLint.outputFixes(lintReport.results)
              )
            );
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
