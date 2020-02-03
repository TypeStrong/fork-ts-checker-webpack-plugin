import process from 'process';
import { createEsLintReporter } from './EsLintReporter';
import { EsLintReporterConfiguration } from '../EsLintReporterConfiguration';
import { registerReporterRpcService } from '../../reporter';
import { createRpcIpcMessagePort } from '../../rpc/rpc-ipc';

const service = registerReporterRpcService<EsLintReporterConfiguration>(
  createRpcIpcMessagePort(process),
  createEsLintReporter
);

service.open();
