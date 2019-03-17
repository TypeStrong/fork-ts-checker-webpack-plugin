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
  emptyWrapperConfig
} from './wrapperUtils';

const wrapperConfig: TypeScriptWrapperConfig =
  process.env.VUE === 'true' ? wrapperConfigWithVue : emptyWrapperConfig;

const typescript: typeof ts = wrapTypescript(
  require(process.env.TYPESCRIPT_PATH!),
  wrapperConfig
);

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
  } catch (error) {
    if (error instanceof typescript.OperationCanceledException) {
      return;
    }

    throw error;
  }

  if (!cancellationToken.isCancellationRequested()) {
    try {
      process.send!({
        diagnostics,
        lints
      });
    } catch (e) {
      // channel closed...
      process.exit();
    }
  }
}

process.on('message', message => {
  run(CancellationToken.createFromJSON(typescript, message));
});

process.on('SIGINT', () => {
  process.exit();
});
