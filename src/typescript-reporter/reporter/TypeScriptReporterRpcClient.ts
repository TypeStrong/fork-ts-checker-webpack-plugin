import path from 'path';
import { TypeScriptReporterConfiguration } from '../TypeScriptReporterConfiguration';
import { createReporterRpcClient, ReporterRpcClient } from '../../reporter';
import { createRpcIpcMessageChannel } from '../../rpc/rpc-ipc';

function createTypeScriptReporterRpcClient(
  configuration: TypeScriptReporterConfiguration
): ReporterRpcClient {
  const channel = createRpcIpcMessageChannel(
    path.resolve(__dirname, './TypeScriptReporterRpcService.js'),
    configuration.memoryLimit
  );

  return createReporterRpcClient(channel, configuration);
}

export { createTypeScriptReporterRpcClient };
