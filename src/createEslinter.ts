// tslint:disable-next-line:no-implicit-dependencies
import * as eslinttypes from 'eslint'; // import for types alone
import { NormalizedMessage } from './NormalizedMessage';
import { throwIfIsInvalidSourceFileError } from './FsHelper';
import { makeCreateNormalizedMessageFromEsLintFailure } from './NormalizedMessageFactories';

export function createEslinter(eslintOptions: object) {
  // tslint:disable-next-line:no-implicit-dependencies
  const eslint: typeof eslinttypes = require('eslint');

  // See https://eslint.org/docs/1.0.0/developer-guide/nodejs-api#cliengine
  const eslinter = new eslint.CLIEngine(eslintOptions);
  const createNormalizedMessageFromEsLintFailure = makeCreateNormalizedMessageFromEsLintFailure();

  function getLintsForFile(filepath: string) {
    try {
      const lints = eslinter.executeOnFiles([filepath]);
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
