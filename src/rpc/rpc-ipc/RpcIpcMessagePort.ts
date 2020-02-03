import { ProcessLike } from './ProcessLike';
import { RpcMessageDispatch, RpcMessagePort } from '../index';
import { ChildProcess, fork } from 'child_process';
import { RpcIpcMessagePortClosedError } from './error/RpcIpcMessagePortClosedError';

function createRpcIpcMessagePort(process: ProcessLike): RpcMessagePort {
  const listeners = new Set<RpcMessageDispatch>();

  let closedError: Error | undefined;
  const handleExit = async (code: string | number | null, signal: string | null) => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    await port.close();

    closedError = new RpcIpcMessagePortClosedError(
      `Process ${process.pid} exited with code ${code}.`,
      code,
      signal
    );
  };
  const handleDisconnect = async () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    await port.close();

    closedError = new RpcIpcMessagePortClosedError(
      `Process ${process.pid} has been disconnected.`,
      null,
      null
    );
  };
  process.on('exit', handleExit);
  process.on('disconnect', handleDisconnect);

  const port: RpcMessagePort = {
    dispatchMessage: async (message) =>
      new Promise((resolve, reject) => {
        if (!process.connected) {
          reject(closedError || new Error(`Process ${process.pid} doesn't have open IPC channels`));
        }

        if (process.send) {
          process.send({ ...message, source: process.pid }, undefined, undefined, (sendError) => {
            if (sendError) {
              reject(closedError || sendError);
            } else {
              resolve();
            }
          });
        } else {
          reject(new Error(`Process ${process.pid} doesn't have IPC channels`));
        }
      }),
    addMessageListener: (listener) => {
      listeners.add(listener);
      process.on('message', listener);
    },
    removeMessageListener: (listener) => {
      listeners.delete(listener);
      process.off('message', listener);
    },
    isOpen: () => !!process.connected,
    open: async () => {
      if (!process.connected || closedError) {
        throw (
          closedError || new Error(`Cannot open closed IPC channel for process ${process.pid}.`)
        );
      }
    },
    close: async () => {
      listeners.forEach((listener) => {
        process.off('message', listener);
        listeners.delete(listener);
      });

      process.off('exit', handleExit);
      process.off('disconnect', handleDisconnect);

      if (process.disconnect && process.connected) {
        process.disconnect();
      }
    },
  };

  return port;
}

function createRpcIpcForkedProcessMessagePort(
  filePath: string,
  memoryLimit = 2048
): RpcMessagePort {
  let childProcess: ChildProcess | undefined = fork(filePath, [], {
    execArgv: [`--max-old-space-size=${memoryLimit}`],
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  });
  const port = createRpcIpcMessagePort(childProcess);

  return {
    ...port,
    close: async () => {
      await port.close();

      if (childProcess) {
        childProcess.kill('SIGTERM');
        childProcess = undefined;
      }
    },
  };
}

export { createRpcIpcMessagePort, createRpcIpcForkedProcessMessagePort };
