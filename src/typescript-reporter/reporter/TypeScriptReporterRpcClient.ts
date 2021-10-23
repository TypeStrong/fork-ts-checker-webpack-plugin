import path from 'path';

import type { ReporterRpcClient } from '../../reporter';
import { createReporterRpcClient } from '../../reporter';
import { createRpcIpcMessageChannel } from '../../rpc/rpc-ipc';
import type { TypeScriptReporterConfiguration } from '../TypeScriptReporterConfiguration';

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
