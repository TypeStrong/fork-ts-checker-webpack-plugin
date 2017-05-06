var ts = require('typescript');
var process = require('process');
var IncrementalChecker = require('./IncrementalChecker');
var CancellationToken = require('./CancellationToken');

var checker = new IncrementalChecker(
  process.env.TSCONFIG,
  process.env.TSLINT === '' ? false : process.env.TSLINT,
  process.env.WATCH === '' ? [] : process.env.WATCH.split('|'),
  parseInt(process.env.WORK_NUMBER, 10),
  parseInt(process.env.WORK_DIVISION, 10)
);

function run (cancellationToken) {
  var diagnostics = [];
  var lints = [];

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
        diagnostics: diagnostics,
        lints: lints
      });
    } catch (e) {
      // channel closed...
      process.exit();
    }
  }
}

process.on('message', function (message) {
  run(CancellationToken.createFromJSON(message));
});

process.on('SIGINT', function () {
  process.exit();
});
