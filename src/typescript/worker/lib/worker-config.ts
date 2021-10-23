import { getRpcWorkerData } from '../../../utils/rpc';
import type { TypeScriptConfig } from '../../typescript-config';

export const config = getRpcWorkerData() as TypeScriptConfig;
