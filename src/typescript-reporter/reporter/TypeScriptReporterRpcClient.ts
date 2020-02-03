import * as path from 'path';
import { TypeScriptReporterConfiguration } from '../TypeScriptReporterConfiguration';
import {
  createReporterRpcClient,
  registerReporterRpcService,
  ReporterRpcClient,
} from '../../reporter';
import { createRpcIpcMessageChannel } from '../../rpc/rpc-ipc';
import { createRpcEventEmitterMessageChannel } from '../../rpc/rpc-event-emitter';
import { createTypeScriptReporter } from './TypeScriptReporter';

function createTypeScriptReporterRpcClient(
  configuration: TypeScriptReporterConfiguration
): ReporterRpcClient {
  const channel = createRpcIpcMessageChannel(
    path.resolve(__dirname, './TypeScriptReporterRpcService.js'),
    configuration.memoryLimit
  );

  return createReporterRpcClient(channel, configuration);
}

function createTypeScriptReporterSameProcessRpcClient(
  configuration: TypeScriptReporterConfiguration
): ReporterRpcClient {
  const channel = createRpcEventEmitterMessageChannel();
  const service = registerReporterRpcService<TypeScriptReporterConfiguration>(
    channel.servicePort,
    (configuration) => createTypeScriptReporter(configuration)
  );
  service.open();

  return createReporterRpcClient(channel, configuration);
}

export { createTypeScriptReporterRpcClient, createTypeScriptReporterSameProcessRpcClient };
