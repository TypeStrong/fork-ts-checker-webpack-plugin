import * as eslint from 'eslint'; // import for types alone
import * as path from 'path';

import { throwIfIsInvalidSourceFileError } from './FsHelper';

export function createEslinter(eslintOptions: object) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CLIEngine }: typeof eslint = require('eslint');

  // See https://eslint.org/docs/1.0.0/developer-guide/nodejs-api#cliengine
  const eslinter = new CLIEngine(eslintOptions);

  function getReport(filepath: string) {
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
