import * as childProcess from 'child_process';
import * as path from 'path';
import * as process from 'process';
import { RpcProvider } from 'worker-rpc';

import { NormalizedMessage } from './NormalizedMessage';
import { Message } from './Message';
import { RunPayload, RunResult, RUN } from './RpcTypes';

// fork workers...
const division = parseInt(process.env.WORK_DIVISION || '', 10);
const workers: childProcess.ChildProcess[] = [];

for (let num = 0; num < division; num++) {
  workers.push(
    childProcess.fork(path.resolve(__dirname, './service.js'), [], {
      execArgv: ['--max-old-space-size=' + process.env.MEMORY_LIMIT],
      env: { ...process.env, WORK_NUMBER: num.toString() },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    })
  );
}

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

// communication with worker processes
const workerRpcs = workers.map(worker => {
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

parentRpc.registerRpcHandler<RunPayload, RunResult>(RUN, async message => {
  const workerResults = await Promise.all(
    workerRpcs.map(workerRpc =>
      workerRpc.rpc<RunPayload, RunResult>(RUN, message)
    )
  );

  function workerFinished(
    workerResult: (Message | undefined)[]
  ): workerResult is Message[] {
    return workerResult.every(result => typeof result !== 'undefined');
  }

  if (!workerFinished(workerResults)) {
    return undefined;
  }

  const merged: Message = workerResults.reduce(
    (innerMerged: Message, innerResult: Message) => ({
      diagnostics: innerMerged.diagnostics.concat(
        innerResult.diagnostics.map(NormalizedMessage.createFromJSON)
      ),
      lints: innerMerged.lints.concat(
        innerResult.lints.map(NormalizedMessage.createFromJSON)
      )
    }),
    { diagnostics: [], lints: [] }
  );

  merged.diagnostics = NormalizedMessage.deduplicate(merged.diagnostics);
  merged.lints = NormalizedMessage.deduplicate(merged.lints);

  return merged;
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
