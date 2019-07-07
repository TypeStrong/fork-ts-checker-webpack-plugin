import * as eslinttypes from 'eslint'; // import for types alone
import { NormalizedMessage } from './NormalizedMessage';
import { FsHelper } from './FsHelper';
import { makeCreateNormalizedMessageFromEsLintFailure } from './NormalizedMessageFactories';

export function makeEslinter(eslintOptions: object) {
  // See https://eslint.org/docs/1.0.0/developer-guide/nodejs-api#cliengine
  const eslint: typeof eslinttypes = require('eslint');
  const eslinter = new eslint.CLIEngine(eslintOptions);
  const createNormalizedMessageFromEsLintFailure = makeCreateNormalizedMessageFromEsLintFailure();

  function getLintsForFile(filepath: string) {
    try {
      const lints = eslinter.executeOnFiles([filepath]);
      return lints;
    } catch (e) {
      if (
        FsHelper.existsSync(filepath) &&
        // check the error type due to file system lag
        !(e instanceof Error) &&
        !(e.constructor.name === 'FatalError') &&
        !(e.message && e.message.trim().startsWith('Invalid source file'))
      ) {
        // it's not because file doesn't exist - throw error
        throw e;
      }
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
