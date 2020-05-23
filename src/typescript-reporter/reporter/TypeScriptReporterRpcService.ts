import process from 'process';
import { createTypeScriptReporter } from './TypeScriptReporter';
import { TypeScriptReporterConfiguration } from '../TypeScriptReporterConfiguration';
import { createRpcIpcMessagePort } from '../../rpc/rpc-ipc';
import { registerReporterRpcService } from '../../reporter';

const service = registerReporterRpcService<TypeScriptReporterConfiguration>(
  createRpcIpcMessagePort(process),
  createTypeScriptReporter
);

service.open();
