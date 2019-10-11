// tslint:disable-next-line:no-implicit-dependencies
import * as eslinttypes from 'eslint'; // import for types alone
import { NormalizedMessage } from './NormalizedMessage';
import { throwIfIsInvalidSourceFileError } from './FsHelper';
import { makeCreateNormalizedMessageFromEsLintFailure } from './NormalizedMessageFactories';
import * as path from 'path';

export function createEslinter(eslintOptions: eslinttypes.CLIEngine.Options) {
  // tslint:disable-next-line:no-implicit-dependencies
  const eslint: typeof eslinttypes = require('eslint');

  // See https://eslint.org/docs/6.0.0/developer-guide/nodejs-api#cliengine
  const eslinter = new eslint.CLIEngine(eslintOptions);
  const createNormalizedMessageFromEsLintFailure = makeCreateNormalizedMessageFromEsLintFailure();

  function getLintsForFile(filepath: string) {
    try {
      if (
        eslinter.isPathIgnored(filepath) ||
        path.extname(filepath).localeCompare('.json', undefined, {
          sensitivity: 'accent'
        }) === 0
      ) {
        return undefined;
      }

      const lints = eslinter.executeOnFiles([filepath]);
      if (eslintOptions && eslintOptions.fix) {
        eslint.CLIEngine.outputFixes(lints);
      }
      return lints;
    } catch (e) {
      throwIfIsInvalidSourceFileError(filepath, e);
    }
    return undefined;
  }

  function getFormattedLints(
    lintReports:
      | IterableIterator<eslinttypes.CLIEngine.LintReport>
      | eslinttypes.CLIEngine.LintReport[]
  ) {
    const allEsLints = [];
    for (const value of lintReports) {
      for (const lint of value.results) {
        allEsLints.push(
          ...lint.messages.map(message =>
            createNormalizedMessageFromEsLintFailure(message, lint.filePath)
          )
        );
      }
    }
    return NormalizedMessage.deduplicate(allEsLints);
  }

  return { getLints: getLintsForFile, getFormattedLints };
}
