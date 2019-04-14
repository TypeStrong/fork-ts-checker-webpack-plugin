import * as childProcess from 'child_process';
import * as path from 'path';
import * as process from 'process';
import { RpcProvider } from 'worker-rpc';

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
      env: { ...process.env, WORK_NUMBER: num },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    })
  );
}

const pids = workers.map(worker => worker.pid);
const result = new WorkResult(pids);

// communication with parent process
const parentRpc = new RpcProvider(message => {
  try {
    process.send!(message);
  } catch (e) {
    // channel closed...
    process.exit();
  }
});
process.on('message', message => parentRpc.dispatch(message));

// communication with child processes
const childrenRpc = workers.map(worker => {
  const rpc = new RpcProvider(message => {
    try {
      worker.send(message);
    } catch (e) {
      // channel closed - something went wrong - close cluster...
      process.exit();
    }
  });
  worker.on('message', message => rpc.dispatch(message));
  return rpc;
});

parentRpc.registerSignalHandler('run', message => {
  // broadcast message to all workers
  childrenRpc.forEach(rpc => rpc.signal('run', message));
  // clear previous result set
  result.clear();
});

// listen to all workers
childrenRpc.forEach((rpc, id) => {
  const worker = workers[id];
  rpc.registerSignalHandler('runResults', (message?: Message) => {
    if (!message) {
      return;
    }
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

      parentRpc.signal('runResults', merged);
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
