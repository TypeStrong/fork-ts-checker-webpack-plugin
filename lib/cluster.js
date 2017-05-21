var process = require('process');
var childProcess = require('child_process');
var path = require('path');

var WorkResult = require('./WorkResult');
var NormalizedMessage = require('./NormalizedMessage');

// fork workers...
var division = parseInt(process.env.WORK_DIVISION);
var workers = [];

for (var number = 0; number < division; number++) {
  workers.push(
    childProcess.fork(
      path.resolve(__dirname, './service.js'),
      [],
      {
        execArgv: ['--max-old-space-size=' + process.env.MEMORY_LIMIT],
        env: Object.assign({}, process.env, { WORK_NUMBER: number }),
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
      }
    )
  );
}

var pids = workers.map(function (worker) { return worker.pid; });
var result = new WorkResult(pids);

process.on('message', function (message) {
  // broadcast message to all workers
  workers.forEach(function (worker) {
    try {
      worker.send(message);
    } catch (e) {
      // channel closed - something went wrong - close cluster...
      process.exit();
    }
  });

  // clear previous result set
  result.clear();
});

// listen to all workers
workers.forEach(function (worker) {
  worker.on('message', function (message) {
    // set result from worker
    result.set(
      worker.pid,
      {
        diagnostics: message.diagnostics.map(NormalizedMessage.createFromJSON),
        lints: message.lints.map(NormalizedMessage.createFromJSON)
      }
    );

    // if we have result from all workers, send merged
    if (result.hasAll()) {
      var merged = result.reduce(
        function (merged, result) {
          return {
            diagnostics: merged.diagnostics.concat(result.diagnostics),
            lints: merged.lints.concat(result.lints)
          };
        },
        { diagnostics: [], lints: [] }
      );

      merged.diagnostics = NormalizedMessage.deduplicate(merged.diagnostics);
      merged.lints = NormalizedMessage.deduplicate(merged.lints);

      try {
        process.send(merged);
      } catch (e) {
        // channel closed...
        process.exit();
      }
    }
  });
});

process.on('SIGINT', function () {
  process.exit();
});

process.on('exit', function () {
  workers.forEach(function (worker) {
    try {
      worker.kill();
    } catch (e) {
      // do nothing...
    }
  });
});