import * as process from 'process';
import * as ts from 'typescript';
import { IncrementalChecker } from './IncrementalChecker';
import { CancellationToken } from './CancellationToken';
import { NormalizedMessage } from './NormalizedMessage';

const checker = new IncrementalChecker(
  process.env.TSCONFIG,
  JSON.parse(process.env.COMPILER_OPTIONS),
  process.env.TSLINT === '' ? false : process.env.TSLINT,
  process.env.WATCH === '' ? [] : process.env.WATCH.split('|'),
  parseInt(process.env.WORK_NUMBER, 10),
  parseInt(process.env.WORK_DIVISION, 10),
  process.env.CHECK_SYNTACTIC_ERRORS === 'true',
  process.env.VUE === 'true'
);

function run(cancellationToken: CancellationToken) {
  let diagnostics: NormalizedMessage[] = [];
  let lints: NormalizedMessage[] = [];

  checker.nextIteration();

  try {
    diagnostics = checker.getDiagnostics(cancellationToken);
    if (checker.hasLinter()) {
      lints = checker.getLints(cancellationToken);
    }
  } catch (error) {
    if (error instanceof ts.OperationCanceledException) {
      return;
    }

    throw error;
  }

  if (!cancellationToken.isCancellationRequested()) {
    try {
      process.send({
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
  run(CancellationToken.createFromJSON(message));
});

process.on('SIGINT', () => {
  process.exit();
});
