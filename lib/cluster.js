var cluster = require('cluster');
var process = require('process');
var path = require('path');

var WorkResult = require('./WorkResult');
var NormalizedMessage = require('./NormalizedMessage');

// setup master
cluster.setupMaster({
  exec: path.join(__dirname, 'service.js'),
  args: ['--max-old-space-size=' + process.env.MEMORY_LIMIT]
});

// fork workers...
var division = parseInt(process.env.WORK_DIVISION);

for (var i = 0; i < division; i++) {
  cluster.fork({ WORK_NUMBER: i });
}

var workerIds = Object.keys(cluster.workers);
var result = new WorkResult(workerIds);

process.on('message', function (message) {
  // broadcast message to all workers
  workerIds.forEach(function (workerId) {
    cluster.workers[workerId].send(message);
  });

  // clear previous result set
  result.clear();
});

// listen to all workers
workerIds.forEach(function (workerId) {
  cluster.workers[workerId].on('message', function (message) {
    // set result from worker
    result.set(
      workerId,
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

      process.send(merged);
    }
  });
});
