import { RpcMessagePort } from './RpcMessagePort';

interface RpcMessageChannel {
  readonly servicePort: RpcMessagePort;
  readonly clientPort: RpcMessagePort;
  readonly isOpen: () => boolean;
  readonly open: () => Promise<void>;
  readonly close: () => Promise<void>;
}

function createRpcMessageChannel(
  servicePort: RpcMessagePort,
  clientPort: RpcMessagePort,
  linkPorts?: () => Promise<void>,
  unlinkPorts?: () => Promise<void>
): RpcMessageChannel {
  // if there is not link and unlink function provided, we assume that channel is automatically linked
  let arePortsLinked = !linkPorts && !unlinkPorts;

  return {
    servicePort,
    clientPort,
    isOpen: () => servicePort.isOpen() && clientPort.isOpen() && arePortsLinked,
    open: async () => {
      if (!servicePort.isOpen()) {
        await servicePort.open();
      }
      if (!clientPort.isOpen()) {
        await clientPort.open();
      }
      if (!arePortsLinked) {
        if (linkPorts) {
          await linkPorts();
        }
        arePortsLinked = true;
      }
    },
    close: async () => {
      if (arePortsLinked) {
        if (unlinkPorts) {
          await unlinkPorts();
        }
        arePortsLinked = false;
      }
      if (servicePort.isOpen()) {
        await servicePort.close();
      }
      if (clientPort.isOpen()) {
        await clientPort.close();
      }
    },
  };
}

export { RpcMessageChannel, createRpcMessageChannel };
