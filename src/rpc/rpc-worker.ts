import * as child_process from 'child_process';
import type { ChildProcess, ForkOptions } from 'child_process';
import * as process from 'process';

import type { RpcMethod, RpcRemoteMethod } from './types';
import { wrapRpc } from './wrap-rpc';

const WORKER_DATA_ENV_KEY = 'WORKER_DATA';

interface RpcWorkerBase {
  connect(): void;
  terminate(): void;
  readonly connected: boolean;
  readonly process: ChildProcess | undefined;
}
type RpcWorker<T extends RpcMethod = RpcMethod> = RpcWorkerBase & RpcRemoteMethod<T>;

function createRpcWorker<T extends RpcMethod>(
  modulePath: string,
  data: unknown,
  memoryLimit?: number
): RpcWorker<T> {
  const options: ForkOptions = {
    env: {
      ...process.env,
      [WORKER_DATA_ENV_KEY]: JSON.stringify(data || {}),
    },
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    serialization: 'advanced',
  };
  if (memoryLimit) {
    options.execArgv = [`--max-old-space-size=${memoryLimit}`];
  }
  let childProcess: ChildProcess | undefined;
  let remoteMethod: RpcRemoteMethod<T> | undefined;

  const worker: RpcWorkerBase = {
    connect() {
      if (childProcess && !childProcess.connected) {
        childProcess.kill('SIGTERM');
        childProcess = undefined;
        remoteMethod = undefined;
      }
      if (!childProcess?.connected) {
        childProcess = child_process.fork(modulePath, options);
        remoteMethod = wrapRpc<T>(childProcess);
      }
    },
    terminate() {
      if (childProcess) {
        childProcess.kill('SIGTERM');
        childProcess = undefined;
        remoteMethod = undefined;
      }
    },
    get connected() {
      return Boolean(childProcess?.connected);
    },
    get process() {
      return childProcess;
    },
  };

  return Object.assign((...args: unknown[]) => {
    if (!worker.connected) {
      // try to auto-connect
      worker.connect();
    }

    if (!remoteMethod) {
      return Promise.reject('Worker is not connected - cannot perform RPC.');
    }

    return remoteMethod(...args);
  }, worker) as RpcWorker<T>;
}
function getRpcWorkerData(): unknown {
  return JSON.parse(process.env[WORKER_DATA_ENV_KEY] || '{}');
}

export { createRpcWorker, getRpcWorkerData, RpcWorker };
