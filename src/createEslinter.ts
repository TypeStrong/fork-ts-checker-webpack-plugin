import * as path from 'path';

import { LintReport } from './types/eslint';
import { throwIfIsInvalidSourceFileError } from './FsHelper';

export function createEslinter(eslintOptions: object) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CLIEngine } = require('eslint');

  // See https://eslint.org/docs/1.0.0/developer-guide/nodejs-api#cliengine
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

      return eslinter.executeOnFiles([filepath]);
    } catch (e) {
      throwIfIsInvalidSourceFileError(filepath, e);
    }
    return undefined;
  }

  return { getReport };
}
