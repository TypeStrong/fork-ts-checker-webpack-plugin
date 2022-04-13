import type { ChildProcess } from 'child_process';

import { createControlledPromise } from '../utils/async/controlled-promise';

import { RpcExitError } from './rpc-error';
import type { RpcRemoteMethod, RpcMessage } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapRpc<T extends (...args: any[]) => any>(
  childProcess: ChildProcess
): RpcRemoteMethod<T> {
  return (async (...args: unknown[]): Promise<unknown> => {
    if (!childProcess.send) {
      throw new Error(`Process ${childProcess.pid} doesn't have IPC channels`);
    } else if (!childProcess.connected) {
      throw new Error(`Process ${childProcess.pid} doesn't have open IPC channels`);
    }

    const id = uuid();

    // create promises
    const {
      promise: resultPromise,
      resolve: resolveResult,
      reject: rejectResult,
    } = createControlledPromise<T>();
    const {
      promise: sendPromise,
      resolve: resolveSend,
      reject: rejectSend,
    } = createControlledPromise<void>();

    const handleMessage = (message: RpcMessage) => {
      if (message?.id === id) {
        if (message.type === 'resolve') {
          // assume the contract is respected
          resolveResult(message.value as T);
          removeHandlers();
        } else if (message.type === 'reject') {
          rejectResult(message.error);
          removeHandlers();
        }
      }
    };
    const handleClose = (code: string | number | null, signal: string | null) => {
      rejectResult(
        new RpcExitError(
          code
            ? `Process ${childProcess.pid} exited with code ${code}` +
              (signal ? ` [${signal}]` : '')
            : `Process ${childProcess.pid} exited` + (signal ? ` [${signal}]` : ''),
          code,
          signal
        )
      );
      removeHandlers();
    };

    // to prevent event handler leaks
    const removeHandlers = () => {
      childProcess.off('message', handleMessage);
      childProcess.off('close', handleClose);
    };

    // add event listeners
    childProcess.on('message', handleMessage);
    childProcess.on('close', handleClose);
    // send call message
    childProcess.send(
      {
        type: 'call',
        id,
        args,
      },
      (error) => {
        if (error) {
          rejectSend(error);
          removeHandlers();
        } else {
          resolveSend(undefined);
        }
      }
    );

    return sendPromise.then(() => resultPromise);
  }) as RpcRemoteMethod<T>;
}

function uuid(): string {
  return new Array(4)
    .fill(0)
    .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
    .join('-');
}
