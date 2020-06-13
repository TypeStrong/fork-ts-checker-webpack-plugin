import { createRpcMessageChannel, RpcMessageChannel } from '../index';
import { createRpcIpcForkedProcessMessagePort } from './RpcIpcMessagePort';

function createRpcIpcMessageChannel(servicePath: string, memoryLimit = 2048): RpcMessageChannel {
  const port = createRpcIpcForkedProcessMessagePort(servicePath, memoryLimit);

  // linked by the child_process IPC implementation - no manual linking needed
  return createRpcMessageChannel(port, port);
}

export { createRpcIpcMessageChannel };
