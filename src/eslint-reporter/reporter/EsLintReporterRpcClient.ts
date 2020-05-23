import * as path from 'path';
import { EsLintReporterConfiguration } from '../EsLintReporterConfiguration';
import { createReporterRpcClient, ReporterRpcClient } from '../../reporter';
import { createRpcIpcMessageChannel } from '../../rpc/rpc-ipc';

function createEsLintReporterRpcClient(
  configuration: EsLintReporterConfiguration
): ReporterRpcClient {
  const channel = createRpcIpcMessageChannel(
    path.resolve(__dirname, './EsLintReporterRpcService.js'),
    configuration.memoryLimit
  );

  return createReporterRpcClient(channel, configuration);
}

export { createEsLintReporterRpcClient };
