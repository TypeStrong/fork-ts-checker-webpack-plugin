import { RpcRemoteError } from './error/RpcRemoteError';
import {
  createRpcCall,
  getRpcMessageKey,
  isRpcReturnMessage,
  isRpcThrowMessage,
} from './RpcMessage';
import type { RpcMessagePort } from './RpcMessagePort';
import type { RpcProcedure, RpcProcedurePayload, RpcProcedureResult } from './RpcProcedure';

interface RpcClient {
  readonly isConnected: () => boolean;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
  readonly dispatchCall: <TProcedure extends RpcProcedure>(
    procedure: TProcedure,
    payload: RpcProcedurePayload<TProcedure>
  ) => Promise<RpcProcedureResult<TProcedure>>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type RpcCallback<TResult = any> = {
  return: (result: TResult) => void;
  throw: (error: any) => void;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

function createRpcClient(port: RpcMessagePort): RpcClient {
  let callIndex = 0;
  const callbacks = new Map<string, RpcCallback>();
  let isListenerRegistered = false;

  const returnOrThrowListener = async (message: unknown) => {
    if (isRpcReturnMessage(message)) {
      const key = getRpcMessageKey(message);
      const callback = callbacks.get(key);

      if (callback) {
        callback.return(message.payload);
        callbacks.delete(key);
      }
    }
    if (isRpcThrowMessage(message)) {
      const key = getRpcMessageKey(message);
      const callback = callbacks.get(key);

      if (callback) {
        callback.throw(new RpcRemoteError(message.payload.message, message.payload.stack));
        callbacks.delete(key);
      }
    }
  };

  const errorListener = async (error: Error) => {
    callbacks.forEach((callback, key) => {
      callback.throw(error);
      callbacks.delete(key);
    });
  };

  return {
    isConnected: () => port.isOpen() && isListenerRegistered,
    connect: async () => {
      if (!port.isOpen()) {
        await port.open();
      }

      if (!isListenerRegistered) {
        port.addMessageListener(returnOrThrowListener);
        port.addErrorListener(errorListener);
        isListenerRegistered = true;
      }
    },
    disconnect: async () => {
      if (isListenerRegistered) {
        port.removeMessageListener(returnOrThrowListener);
        port.removeErrorListener(errorListener);
        isListenerRegistered = false;
      }

      if (port.isOpen()) {
        await port.close();
      }
    },
    dispatchCall: async (procedure, payload) =>
      new Promise((resolve, reject) => {
        const call = createRpcCall(procedure, callIndex++, payload);
        const key = getRpcMessageKey(call);

        callbacks.set(key, { return: resolve, throw: reject });

        port.dispatchMessage(call).catch((error) => {
          callbacks.delete(key);
          reject(error);
        });
      }),
  };
}

export { RpcClient, createRpcClient };
