import * as path from 'path';

import { LintReport, Options as EslintOptions } from './types/eslint';
import { throwIfIsInvalidSourceFileError } from './FsHelper';

export function createEslinter(eslintOptions: EslintOptions) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CLIEngine } = require('eslint');

  // See https://eslint.org/docs/developer-guide/nodejs-api#cliengine
  const eslinter = new CLIEngine(eslintOptions);

  function getReport(filepath: string): LintReport | undefined {
    try {
      if (
        eslinter.isPathIgnored(filepath) ||
        path.extname(filepath).localeCompare('.json', undefined, {
          sensitivity: 'accent'
        }) === 0
      ) {
        return undefined;
      }

      const lintReport = eslinter.executeOnFiles([filepath]);

      if (eslintOptions && eslintOptions.fix) {
        CLIEngine.outputFixes(lintReport);
      }

      return lintReport;
    } catch (e) {
      throwIfIsInvalidSourceFileError(filepath, e);
    }
    return undefined;
  }

  return { getReport };
}
