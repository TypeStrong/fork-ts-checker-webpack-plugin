import type { ChildProcess } from 'child_process';
import { fork } from 'child_process';

import type { RpcMessagePort, RpcMessageListener, RpcErrorListener } from '../index';

import { RpcIpcMessagePortClosedError } from './error/RpcIpcMessagePortClosedError';
import type { ProcessLike } from './ProcessLike';

function createRpcIpcMessagePort(process: ProcessLike): RpcMessagePort {
  const messageListeners = new Set<RpcMessageListener>();
  const errorListeners = new Set<RpcErrorListener>();
  let closedError: Error | undefined;

  const handleExit = async (code: string | number | null, signal: string | null) => {
    closedError = new RpcIpcMessagePortClosedError(
      code
        ? `Process ${process.pid} exited with code "${code}" [${signal}]`
        : `Process ${process.pid} exited [${signal}].`,
      code,
      signal
    );
    errorListeners.forEach((listener) => {
      if (closedError) {
        listener(closedError);
      }
    });

    await port.close();
  };
  const handleMessage = (message: unknown) => {
    messageListeners.forEach((listener) => {
      listener(message);
    });
  };
  process.on('message', handleMessage);
  process.on('exit', handleExit);

  const port: RpcMessagePort = {
    dispatchMessage: async (message) =>
      new Promise((resolve, reject) => {
        if (!process.connected) {
          reject(
            closedError ||
              new RpcIpcMessagePortClosedError(
                `Process ${process.pid} doesn't have open IPC channels`
              )
          );
        }

        if (process.send) {
          process.send({ ...message, source: process.pid }, undefined, undefined, (sendError) => {
            if (sendError) {
              if (!closedError) {
                closedError = new RpcIpcMessagePortClosedError(
                  `Cannot send the message - the message port has been closed for the process ${process.pid}.`
                );
              }
              reject(closedError);
            } else {
              resolve();
            }
          });
        } else {
          reject(
            new RpcIpcMessagePortClosedError(`Process ${process.pid} doesn't have IPC channels`)
          );
        }
      }),
    addMessageListener: (listener) => {
      messageListeners.add(listener);
    },
    removeMessageListener: (listener) => {
      messageListeners.delete(listener);
    },
    addErrorListener: (listener) => {
      errorListeners.add(listener);
    },
    removeErrorListener: (listener) => {
      errorListeners.delete(listener);
    },
    isOpen: () => !!process.connected,
    open: async () => {
      if (!process.connected || closedError) {
        throw (
          closedError ||
          new RpcIpcMessagePortClosedError(
            `Cannot open closed IPC channel for process ${process.pid}.`
          )
        );
      }
    },
    close: async () => {
      process.off('message', handleMessage);
      process.off('exit', handleExit);

      messageListeners.clear();
      errorListeners.clear();

      if (process.disconnect && process.connected) {
        process.disconnect();
      }
    },
  };

  return port;
}

function createRpcIpcForkedProcessMessagePort(
  filePath: string,
  memoryLimit = 2048,
  autoRecreate = true
): RpcMessagePort {
  function createChildProcess(): ChildProcess {
    return fork(filePath, [], {
      execArgv: [`--max-old-space-size=${memoryLimit}`],
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });
  }
  const messageListeners = new Set<RpcMessageListener>();
  const errorListeners = new Set<RpcErrorListener>();

  let childProcess: ChildProcess | undefined = createChildProcess();
  let port = createRpcIpcMessagePort(childProcess);

  return {
    dispatchMessage: (message) => port.dispatchMessage(message),
    addMessageListener: (listener) => {
      messageListeners.add(listener);
      return port.addMessageListener(listener);
    },
    removeMessageListener: (listener) => {
      messageListeners.delete(listener);
      return port.removeMessageListener(listener);
    },
    addErrorListener: (listener) => {
      errorListeners.add(listener);
      return port.addErrorListener(listener);
    },
    removeErrorListener: (listener) => {
      errorListeners.delete(listener);
      return port.removeErrorListener(listener);
    },
    isOpen: () => port.isOpen(),
    open: async () => {
      if (!port.isOpen() && autoRecreate) {
        // recreate the process and add existing message listeners
        childProcess = createChildProcess();
        port = createRpcIpcMessagePort(childProcess);

        messageListeners.forEach((listener) => {
          port.addMessageListener(listener);
        });
        errorListeners.forEach((listener) => {
          port.addErrorListener(listener);
        });
      } else {
        return port.open();
      }
    },
    close: async () => {
      await port.close();

      messageListeners.clear();
      errorListeners.clear();

      if (childProcess) {
        childProcess.kill('SIGTERM');
        childProcess = undefined;
      }
    },
  };
}

export { createRpcIpcMessagePort, createRpcIpcForkedProcessMessagePort };
