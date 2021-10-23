import process from 'process';

import { registerReporterRpcService } from '../../reporter';
import { createRpcIpcMessagePort } from '../../rpc/rpc-ipc';
import type { TypeScriptReporterConfiguration } from '../TypeScriptReporterConfiguration';

import { createTypeScriptReporter } from './TypeScriptReporter';

const service = registerReporterRpcService<TypeScriptReporterConfiguration>(
  createRpcIpcMessagePort(process),
  createTypeScriptReporter
);

service.open();
