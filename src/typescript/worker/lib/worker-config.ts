import { getRpcWorkerData } from '../../../rpc';
import type { TypeScriptWorkerConfig } from '../../type-script-worker-config';

export const config = getRpcWorkerData() as TypeScriptWorkerConfig;
