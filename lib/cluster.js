var cluster = require('cluster');
var process = require('process');

if (cluster.isMaster) {
  var WorkResultSet = require('./WorkResultSet');
  var resultSet = new WorkResultSet();

  // fork workers...
  var division = parseInt(process.env.WORK_DIVISION);

  for (var i = 0; i < division; i++) {
    cluster.fork({ WORK_NUMBER: i });
  }

  var workerIds = Object.keys(cluster.workers);

  process.on('message', function (message) {
    // broadcast message to all workers
    workerIds.forEach(function (workerId) {
      cluster.workers[workerId].send(message);
    });

    // clear previous result set
    resultSet.clear();
  });

  // listen to all workers
  workerIds.forEach(function (workerId) {
    cluster.workers[workerId].on('message', function (message) {
      // set result from worker
      resultSet.set(workerId, message);

      // if we have result from all workers, send merged
      if (resultSet.done(workerIds)) {
        process.send(resultSet.merge());
      }
    });
  });
} else {
  require('./service');
}
