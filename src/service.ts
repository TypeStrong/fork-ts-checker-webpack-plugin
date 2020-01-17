import * as ts from 'typescript'; // import for types alone

import { IncrementalChecker } from './IncrementalChecker';
import { CancellationToken } from './CancellationToken';
import {
  IncrementalCheckerInterface,
  IncrementalCheckerParams
} from './IncrementalCheckerInterface';
import { ApiIncrementalChecker } from './ApiIncrementalChecker';
import { RpcProvider } from 'worker-rpc';
import { RunPayload, RunResult, RUN } from './RpcTypes';
import { TypeScriptPatchConfig, patchTypescript } from './patchTypescript';
import { createEslinter } from './createEslinter';
import { createIssueFromInternalError, Issue } from './issue';

const rpc = new RpcProvider(message => {
  try {
    if (process.send) {
      process.send(message, undefined, undefined, error => {
        if (error) {
          process.exit();
        }
      });
    }
  } catch (e) {
    // channel closed...
    process.exit();
  }
});
process.on('message', message => rpc.dispatch(message));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const typescript: typeof ts = require(String(process.env.TYPESCRIPT_PATH));
const patchConfig: TypeScriptPatchConfig = {
  skipGetSyntacticDiagnostics:
    process.env.USE_INCREMENTAL_API === 'true' &&
    process.env.CHECK_SYNTACTIC_ERRORS !== 'true'
};

patchTypescript(typescript, patchConfig);

const resolveModuleName = process.env.RESOLVE_MODULE_NAME
  ? require(process.env.RESOLVE_MODULE_NAME).resolveModuleName
  : undefined;
const resolveTypeReferenceDirective = process.env
  .RESOLVE_TYPE_REFERENCE_DIRECTIVE
  ? require(process.env.RESOLVE_TYPE_REFERENCE_DIRECTIVE)
      .resolveTypeReferenceDirective
  : undefined;

const eslinter =
  process.env.ESLINT === 'true'
    ? createEslinter(JSON.parse(String(process.env.ESLINT_OPTIONS)))
    : undefined;

function createChecker(
  useIncrementalApi: boolean
): IncrementalCheckerInterface {
  const incrementalCheckerParams: IncrementalCheckerParams = {
    typescript,
    context: String(process.env.CONTEXT),
    programConfigFile: String(process.env.TSCONFIG),
    compilerOptions: JSON.parse(String(process.env.COMPILER_OPTIONS)),
    eslinter,
    checkSyntacticErrors: process.env.CHECK_SYNTACTIC_ERRORS === 'true',
    resolveModuleName,
    resolveTypeReferenceDirective,
    vue: JSON.parse(String(process.env.VUE))
  };

  return useIncrementalApi
    ? new ApiIncrementalChecker(incrementalCheckerParams)
    : new IncrementalChecker(incrementalCheckerParams);
}

const checker = createChecker(process.env.USE_INCREMENTAL_API === 'true');

async function run(cancellationToken: CancellationToken) {
  const diagnostics: Issue[] = [];
  const lints: Issue[] = [];

  try {
    checker.nextIteration();

    diagnostics.push(...(await checker.getTypeScriptIssues(cancellationToken)));
    if (checker.hasEsLinter()) {
      lints.push(...(await checker.getEsLintIssues(cancellationToken)));
    }
  } catch (error) {
    if (error instanceof typescript.OperationCanceledException) {
      return undefined;
    }

    diagnostics.push(createIssueFromInternalError(error));
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
    ? run(CancellationToken.createFromJSON(typescript, message))
    : undefined
);

process.on('SIGINT', () => {
  process.exit();
});
