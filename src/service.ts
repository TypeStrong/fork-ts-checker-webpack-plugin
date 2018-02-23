import process = require('process');
import ts = require('typescript');
import IncrementalChecker = require('./IncrementalChecker');
import CancellationToken = require('./CancellationToken');
import NormalizedMessage = require('./NormalizedMessage');
const compiler: typeof ts = require(process.env.COMPILER);

const checker = new IncrementalChecker(
  compiler,
  process.env.TSCONFIG,
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
    if (error instanceof compiler.OperationCanceledException) {
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

process.on('message', (message) => {
  run(CancellationToken.createFromJSON(compiler, message));
});

process.on('SIGINT', () => {
  process.exit();
});
