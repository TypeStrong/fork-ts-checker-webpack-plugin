import { createRpcMessageChannel, RpcMessageChannel } from '../index';
import { createRpcEventEmitterMessagePort } from './RpcEventEmitterMessagePort';
import { EventEmitter } from 'events';

function createRpcEventEmitterMessageChannel(): RpcMessageChannel {
  const serviceEmitter = new EventEmitter();
  const clientEmitter = new EventEmitter();

  const serviceToClientForwarder = (message: unknown) => {
    clientEmitter.emit('message', message);
  };
  const clientToServiceForwarder = (message: unknown) => {
    serviceEmitter.emit('message', message);
  };

  const servicePort = createRpcEventEmitterMessagePort(serviceEmitter);
  const clientPort = createRpcEventEmitterMessagePort(clientEmitter);

  return createRpcMessageChannel(
    servicePort,
    clientPort,
    async () => {
      serviceEmitter.on('dispatch_message', serviceToClientForwarder);
      clientEmitter.on('dispatch_message', clientToServiceForwarder);
    },
    async () => {
      serviceEmitter.off('dispatch_message', serviceToClientForwarder);
      clientEmitter.off('dispatch_message', clientToServiceForwarder);
    }
  );
}

export { createRpcEventEmitterMessageChannel };
