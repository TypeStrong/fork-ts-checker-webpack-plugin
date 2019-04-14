import * as process from 'process';
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // import for types alone
import { IncrementalChecker } from './IncrementalChecker';
import { CancellationToken } from './CancellationToken';
import { NormalizedMessage } from './NormalizedMessage';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { ApiIncrementalChecker } from './ApiIncrementalChecker';
import {
  makeCreateNormalizedMessageFromDiagnostic,
  makeCreateNormalizedMessageFromRuleFailure
} from './NormalizedMessageFactories';
import { wrapTypescript } from './wrapTypeScript';
import {
  TypeScriptWrapperConfig,
  wrapperConfigWithVue,
  emptyWrapperConfig,
  getWrapperUtils
} from './wrapperUtils';
import { RpcProvider } from 'worker-rpc';
import { Payload, Result, RPC } from './RpcTypes';

const rpc = new RpcProvider(message => {
  try {
    process.send!(message);
  } catch (e) {
    // channel closed...
    process.exit();
  }
});
process.on('message', message => rpc.dispatch(message));

const wrapperConfig: TypeScriptWrapperConfig =
  process.env.VUE === 'true' ? wrapperConfigWithVue : emptyWrapperConfig;

const typescript: typeof ts = wrapTypescript(
  require(process.env.TYPESCRIPT_PATH!),
  wrapperConfig
);
const { unwrapFileName } = getWrapperUtils(wrapperConfig);

// message factories
export const createNormalizedMessageFromDiagnostic = makeCreateNormalizedMessageFromDiagnostic(
  typescript
);
export const createNormalizedMessageFromRuleFailure = makeCreateNormalizedMessageFromRuleFailure();

const checker: IncrementalCheckerInterface =
  process.env.USE_INCREMENTAL_API === 'true'
    ? new ApiIncrementalChecker(
        typescript,
        createNormalizedMessageFromDiagnostic,
        createNormalizedMessageFromRuleFailure,
        process.env.TSCONFIG!,
        JSON.parse(process.env.COMPILER_OPTIONS!),
        process.env.CONTEXT!,
        process.env.TSLINT === 'true' ? true : process.env.TSLINT! || false,
        process.env.TSLINTAUTOFIX === 'true',
        process.env.CHECK_SYNTACTIC_ERRORS === 'true'
      )
    : new IncrementalChecker(
        typescript,
        createNormalizedMessageFromDiagnostic,
        createNormalizedMessageFromRuleFailure,
        process.env.TSCONFIG!,
        JSON.parse(process.env.COMPILER_OPTIONS!),
        process.env.CONTEXT!,
        process.env.TSLINT === 'true' ? true : process.env.TSLINT! || false,
        process.env.TSLINTAUTOFIX === 'true',
        process.env.WATCH === '' ? [] : process.env.WATCH!.split('|'),
        parseInt(process.env.WORK_NUMBER!, 10) || 0,
        parseInt(process.env.WORK_DIVISION!, 10) || 1,
        process.env.CHECK_SYNTACTIC_ERRORS === 'true',
        wrapperConfig
      );

async function run(cancellationToken: CancellationToken) {
  let diagnostics: NormalizedMessage[] = [];
  let lints: NormalizedMessage[] = [];

  checker.nextIteration();

  try {
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

    throw error;
  }

  if (cancellationToken.isCancellationRequested()) {
    return undefined;
  }

  return {
    diagnostics,
    lints
  };
}

rpc.registerRpcHandler<Payload<RPC.RUN>, Result<RPC.RUN>>(RPC.RUN, message =>
  run(CancellationToken.createFromJSON(typescript, message!))
);

process.on('SIGINT', () => {
  process.exit();
});

if (process.env.RUNNING_IN_TEST === 'true') {
  require('./testRpc').initTestRpc({ rpc, checker });
}
