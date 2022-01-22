import type { ChildProcess } from 'child_process';
import * as process from 'process';

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

    const resultPromise = new Promise((resolve, reject) => {
      const handleMessage = (message: RpcMessage) => {
        if (message.id === id) {
          if (message.type === 'resolve') {
            resolve(message.value);
            unsubscribe();
          } else if (message.type === 'reject') {
            reject(message.error);
            unsubscribe();
          }
        }
      };
      const handleClose = (code: string | number | null, signal: string | null) => {
        reject(
          new RpcExitError(
            code
              ? `Process ${process.pid} exited with code "${code}" [${signal}]`
              : `Process ${process.pid} exited [${signal}].`,
            code,
            signal
          )
        );
        unsubscribe();
      };

      const subscribe = () => {
        childProcess.on('message', handleMessage);
        childProcess.on('close', handleClose);
      };
      const unsubscribe = () => {
        childProcess.off('message', handleMessage);
        childProcess.off('exit', handleClose);
      };

      subscribe();
    });

    await new Promise<void>((resolve, reject) => {
      childProcess.send(
        {
          type: 'call',
          id,
          args,
        },
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(undefined);
          }
        }
      );
    });

    return resultPromise;
  }) as RpcRemoteMethod<T>;
}

function uuid(): string {
  return new Array(4)
    .fill(0)
    .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
    .join('-');
}
