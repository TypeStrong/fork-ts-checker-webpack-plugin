import * as process from 'process';
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // import for types alone
import * as eslinttypes from 'eslint'; // import for types alone

import { IncrementalChecker } from './IncrementalChecker';
import { CancellationToken } from './CancellationToken';
import { NormalizedMessage } from './NormalizedMessage';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { ApiIncrementalChecker } from './ApiIncrementalChecker';
import {
  makeCreateNormalizedMessageFromDiagnostic,
  makeCreateNormalizedMessageFromRuleFailure,
  makeCreateNormalizedMessageFromEsLintFailure,
  makeCreateNormalizedMessageFromInternalError
} from './NormalizedMessageFactories';
import { RpcProvider } from 'worker-rpc';
import { RunPayload, RunResult, RUN } from './RpcTypes';
import { TypeScriptPatchConfig, patchTypescript } from './patchTypescript';

const rpc = new RpcProvider(message => {
  try {
    process.send!(message);
  } catch (e) {
    // channel closed...
    process.exit();
  }
});
process.on('message', message => rpc.dispatch(message));

const typescript: typeof ts = require(process.env.TYPESCRIPT_PATH!);
const patchConfig: TypeScriptPatchConfig = {
  skipGetSyntacticDiagnostics:
    process.env.USE_INCREMENTAL_API === 'true' &&
    process.env.CHECK_SYNTACTIC_ERRORS !== 'true'
};

patchTypescript(typescript, patchConfig);

// message factories
export const createNormalizedMessageFromDiagnostic = makeCreateNormalizedMessageFromDiagnostic(
  typescript
);
export const createNormalizedMessageFromRuleFailure = makeCreateNormalizedMessageFromRuleFailure();
export const createNormalizedMessageFromEsLintFailure = makeCreateNormalizedMessageFromEsLintFailure();
export const createNormalizedMessageFromInternalError = makeCreateNormalizedMessageFromInternalError();

const resolveModuleName = process.env.RESOLVE_MODULE_NAME
  ? require(process.env.RESOLVE_MODULE_NAME!).resolveModuleName
  : undefined;
const resolveTypeReferenceDirective = process.env
  .RESOLVE_TYPE_REFERENCE_DIRECTIVE
  ? require(process.env.RESOLVE_TYPE_REFERENCE_DIRECTIVE!)
      .resolveTypeReferenceDirective
  : undefined;

let eslinter: eslinttypes.CLIEngine | undefined = undefined;
if (process.env.ESLINT === 'true') {
  // See https://eslint.org/docs/1.0.0/developer-guide/nodejs-api#cliengine
  const eslint: typeof eslinttypes = require('eslint');
  eslinter = new eslint.CLIEngine(JSON.parse(process.env.ESLINT_OPTIONS!));
}

const checker: IncrementalCheckerInterface =
  process.env.USE_INCREMENTAL_API === 'true'
    ? new ApiIncrementalChecker(
        typescript,
        process.env.CONTEXT!,
        process.env.TSCONFIG!,
        JSON.parse(process.env.COMPILER_OPTIONS!),
        createNormalizedMessageFromDiagnostic,
        process.env.TSLINT === 'true' ? true : process.env.TSLINT! || false,
        process.env.TSLINTAUTOFIX === 'true',
        createNormalizedMessageFromRuleFailure,
        eslinter,
        createNormalizedMessageFromEsLintFailure,
        process.env.CHECK_SYNTACTIC_ERRORS === 'true',
        resolveModuleName,
        resolveTypeReferenceDirective
      )
    : new IncrementalChecker(
        typescript,
        process.env.CONTEXT!,
        process.env.TSCONFIG!,
        JSON.parse(process.env.COMPILER_OPTIONS!),
        createNormalizedMessageFromDiagnostic,
        process.env.TSLINT === 'true' ? true : process.env.TSLINT! || false,
        process.env.TSLINTAUTOFIX === 'true',
        createNormalizedMessageFromRuleFailure,
        eslinter,
        createNormalizedMessageFromEsLintFailure,
        process.env.WATCH === '' ? [] : process.env.WATCH!.split('|'),
        parseInt(process.env.WORK_NUMBER!, 10) || 0,
        parseInt(process.env.WORK_DIVISION!, 10) || 1,
        process.env.CHECK_SYNTACTIC_ERRORS === 'true',
        process.env.VUE === 'true',
        resolveModuleName,
        resolveTypeReferenceDirective
      );

async function run(cancellationToken: CancellationToken) {
  let diagnostics: NormalizedMessage[] = [];
  let lints: NormalizedMessage[] = [];

  try {
    checker.nextIteration();

    diagnostics = await checker.getDiagnostics(cancellationToken);
    if (checker.hasEsLinter()) {
      lints = checker.getEsLints(cancellationToken);
    } else if (checker.hasLinter()) {
      lints = checker.getLints(cancellationToken);
    }
  } catch (error) {
    if (error instanceof typescript.OperationCanceledException) {
      return undefined;
    }

    diagnostics.push(createNormalizedMessageFromInternalError(error));
  }

  if (cancellationToken.isCancellationRequested()) {
    return undefined;
  }

  return {
    diagnostics,
    lints
  };
}

rpc.registerRpcHandler<RunPayload, RunResult>(RUN, message =>
  typeof message !== 'undefined'
    ? run(CancellationToken.createFromJSON(typescript, message!))
    : undefined
);

process.on('SIGINT', () => {
  process.exit();
});
