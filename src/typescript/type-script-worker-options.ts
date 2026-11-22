import type { TypeScriptConfigOverwrite } from './type-script-config-overwrite';
import type { TypeScriptDiagnosticsOptions } from './type-script-diagnostics-options';

// keep in sync with the `mode` enum in plugin-options.json - a unit test checks it
const TYPESCRIPT_WORKER_MODES = ['in-memory', 'write-dts', 'write'] as const;
type TypeScriptWorkerMode = (typeof TYPESCRIPT_WORKER_MODES)[number];

type TypeScriptWorkerOptions = {
  configFile?: string;
  configOverwrite?: TypeScriptConfigOverwrite;
  context?: string;
  build?: boolean;
  mode?: TypeScriptWorkerMode;
  diagnosticOptions?: Partial<TypeScriptDiagnosticsOptions>;
  profile?: boolean;
  typescriptPath?: string;
};

export { TYPESCRIPT_WORKER_MODES, TypeScriptWorkerMode, TypeScriptWorkerOptions };
