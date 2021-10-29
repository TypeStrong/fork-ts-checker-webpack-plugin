import { createRpcReturn, createRpcThrow, isRpcCallMessage } from './RpcMessage';
import type { RpcMessagePort } from './RpcMessagePort';
import type { RpcProcedure } from './RpcProcedure';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcCallHandler<TPayload = any, TResult = any> = (payload: TPayload) => Promise<TResult>;

interface RpcService {
  readonly isOpen: () => boolean;
  readonly open: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly addCallHandler: <TPayload, TResult>(
    procedure: RpcProcedure<TPayload, TResult>,
    handler: RpcCallHandler<TPayload, TResult>
  ) => void;
  readonly removeCallHandler: <TPayload, TResult>(
    procedure: RpcProcedure<TPayload, TResult>
  ) => void;
}

function createRpcService(port: RpcMessagePort): RpcService {
  const handlers = new Map<RpcProcedure, RpcCallHandler>();
  let isListenerRegistered = false;

  const callListener = async (message: unknown) => {
    if (isRpcCallMessage(message)) {
      const handler = handlers.get(message.procedure);

      try {
        if (!handler) {
          throw new Error(`No handler found for procedure ${message.procedure}.`);
        }

        const result = await handler(message.payload);

        await port.dispatchMessage(createRpcReturn(message.procedure, message.id, result));
      } catch (error) {
        await port.dispatchMessage(
          createRpcThrow(message.procedure, message.id, {
            message: error.toString(),
            stack: error.stack,
          })
        );
      }
    }
  };

  return {
    isOpen: () => port.isOpen() && isListenerRegistered,
    open: async () => {
      if (!port.isOpen()) {
        await port.open();
      }

      if (!isListenerRegistered) {
        port.addMessageListener(callListener);
        isListenerRegistered = true;
      }
    },
    close: async () => {
      if (isListenerRegistered) {
        port.removeMessageListener(callListener);
        isListenerRegistered = false;
      }

      if (port.isOpen()) {
        await port.close();
      }
    },
    addCallHandler: (procedure, handler) => {
      if (handlers.has(procedure)) {
        throw new Error(`Handler for '${procedure}' procedure has been already registered`);
      }

      handlers.set(procedure, handler);
    },
    removeCallHandler: (procedure) => handlers.delete(procedure),
  };
}

export { RpcService, createRpcService };
