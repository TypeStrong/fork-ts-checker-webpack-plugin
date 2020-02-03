import { RpcMessageDispatch, RpcMessagePort } from '../index';
import { EventEmitter } from 'events';

function createRpcEventEmitterMessagePort(emitter: EventEmitter): RpcMessagePort {
  const listeners = new Set<RpcMessageDispatch>();

  return {
    dispatchMessage: async (message) => {
      emitter.emit('dispatch_message', JSON.parse(JSON.stringify(message)));
    },
    addMessageListener: (listener) => {
      listeners.add(listener);
      emitter.on('message', listener);
    },
    removeMessageListener: (listener) => {
      listeners.delete(listener);
      emitter.off('message', listener);
    },
    isOpen: () => true,
    open: async () => undefined,
    close: async () => {
      listeners.forEach((listener) => {
        emitter.off('message', listener);
        listeners.delete(listener);
      });
    },
  };
}

export { createRpcEventEmitterMessagePort };
