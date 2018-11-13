import * as childProcess from 'child_process';
import * as path from 'path';
import * as process from 'process';

import { WorkResult } from './WorkResult';
import { NormalizedMessage } from './NormalizedMessage';
import { Message } from './Message';

// fork workers...
const division = parseInt(process.env.WORK_DIVISION || '', 10);
const workers: childProcess.ChildProcess[] = [];

for (let num = 0; num < division; num++) {
  workers.push(
    childProcess.fork(path.resolve(__dirname, './service.js'), [], {
      execArgv: ['--max-old-space-size=' + process.env.MEMORY_LIMIT],
      env: Object.assign({}, process.env, { WORK_NUMBER: num }),
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    })
  );
}

const pids = workers.map(worker => worker.pid);
const result = new WorkResult(pids);

process.on('message', (message: Message) => {
  // broadcast message to all workers
  workers.forEach(worker => {
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
workers.forEach(worker => {
  worker.on('message', (message: Message) => {
    // set result from worker
    result.set(worker.pid, {
      diagnostics: message.diagnostics.map(NormalizedMessage.createFromJSON),
      lints: message.lints.map(NormalizedMessage.createFromJSON)
    });

    // if we have result from all workers, send merged
    if (result.hasAll()) {
      const merged: Message = result.reduce(
        (innerMerged: Message, innerResult: Message) => ({
          diagnostics: innerMerged.diagnostics.concat(innerResult.diagnostics),
          lints: innerMerged.lints.concat(innerResult.lints)
        }),
        { diagnostics: [], lints: [] }
      );

      merged.diagnostics = NormalizedMessage.deduplicate(merged.diagnostics);
      merged.lints = NormalizedMessage.deduplicate(merged.lints);

      try {
        process.send!(merged);
      } catch (e) {
        // channel closed...
        process.exit();
      }
    }
  });
});

process.on('SIGINT', () => {
  process.exit();
});

process.on('exit', () => {
  workers.forEach(worker => {
    try {
      worker.kill();
    } catch (e) {
      // do nothing...
    }
  });
});
