import { getRpcWorkerData } from '../../../utils/rpc';
import type { TypeScriptReporterConfiguration } from '../../TypeScriptReporterConfiguration';

export const config = getRpcWorkerData() as TypeScriptReporterConfiguration;
