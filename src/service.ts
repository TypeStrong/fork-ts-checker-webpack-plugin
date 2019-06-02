import * as mockRequire from 'mock-require';
import { serviceConfig as config } from './serviceConfig';
import { getWrapperUtils } from './wrapperUtils';

const { unwrapFileName, wrapFileName } = getWrapperUtils(config.wrapperConfig);

// mock the "fs" module
mockRequire(
  'fs',
  require('./fakeExtensionFs').build(
    require('fs'),
    unwrapFileName,
    wrapFileName
  )
);
mockRequire.reRequire('fs');

// now continue with everything as normal

// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // import for types alone
import { IncrementalChecker } from './IncrementalChecker';
import { CancellationToken } from './CancellationToken';
import { NormalizedMessage } from './NormalizedMessage';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { ApiIncrementalChecker } from './ApiIncrementalChecker';
import {
  makeCreateNormalizedMessageFromDiagnostic,
  makeCreateNormalizedMessageFromRuleFailure,
  makeCreateNormalizedMessageFromInternalError
} from './NormalizedMessageFactories';
import { patchTypescript } from './wrapTypeScript';
import { RpcProvider } from 'worker-rpc';
import { RunPayload, RunResult, RUN } from './RpcTypes';
import {
  TypeScriptPatchConfig,
  patchTypescript as patchTypescript2
} from './patchTypescript';

const rpc = new RpcProvider(message => {
  try {
    process.send!(message);
  } catch (e) {
    // channel closed...
    process.exit();
  }
});
process.on('message', message => rpc.dispatch(message));

const typescript: typeof ts = patchTypescript(
  require(config.typescriptPath),
  config.wrapperConfig
);

const patchConfig: TypeScriptPatchConfig = {
  skipGetSyntacticDiagnostics:
    config.useIncrementalApi && !config.checkSyntacticErrors
};

patchTypescript2(typescript, patchConfig);

// message factories
export const createNormalizedMessageFromDiagnostic = makeCreateNormalizedMessageFromDiagnostic(
  typescript
);
export const createNormalizedMessageFromRuleFailure = makeCreateNormalizedMessageFromRuleFailure();
export const createNormalizedMessageFromInternalError = makeCreateNormalizedMessageFromInternalError();

const checker: IncrementalCheckerInterface = config.useIncrementalApi
  ? new ApiIncrementalChecker(
      typescript,
      createNormalizedMessageFromDiagnostic,
      createNormalizedMessageFromRuleFailure,
      config.programConfigFile,
      config.compilerOptions,
      config.context,
      config.linterConfigFile,
      config.linterAutoFix,
      config.checkSyntacticErrors
    )
  : new IncrementalChecker(
      typescript,
      createNormalizedMessageFromDiagnostic,
      createNormalizedMessageFromRuleFailure,
      config.programConfigFile,
      config.compilerOptions,
      config.context,
      config.linterConfigFile,
      config.linterAutoFix,
      config.watchPaths,
      config.workNumber,
      config.workDivision,
      config.checkSyntacticErrors
    );

async function run(cancellationToken: CancellationToken) {
  let diagnostics: NormalizedMessage[] = [];
  let lints: NormalizedMessage[] = [];

  try {
    checker.nextIteration();

    diagnostics = await checker.getDiagnostics(cancellationToken);
    if (checker.hasLinter()) {
      lints = checker.getLints(cancellationToken);
    }

    diagnostics = diagnostics.map(diagnostic => {
      if (diagnostic.file) {
        const unwrappedFileName = unwrapFileName(diagnostic.file);

        if (unwrappedFileName !== diagnostic.file) {
          return new NormalizedMessage({
            ...diagnostic.toJSON(),
            file: unwrappedFileName
          });
        }
      }
      return diagnostic;
    });
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
