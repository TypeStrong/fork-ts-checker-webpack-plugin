import type { TypeScriptVueExtensionOptions } from './extension/vue/TypeScriptVueExtensionOptions';
import type { TypeScriptConfigurationOverwrite } from './TypeScriptConfigurationOverwrite';
import type { TypeScriptDiagnosticsOptions } from './TypeScriptDiagnosticsOptions';

type TypeScriptReporterOptions = {
  memoryLimit?: number;
  configFile?: string;
  configOverwrite?: TypeScriptConfigurationOverwrite;
  context?: string;
  build?: boolean;
  mode?: 'readonly' | 'write-tsbuildinfo' | 'write-references';
  diagnosticOptions?: Partial<TypeScriptDiagnosticsOptions>;
  extensions?: {
    vue?: TypeScriptVueExtensionOptions;
  };
  profile?: boolean;
  typescriptPath?: string;
};

export { TypeScriptReporterOptions };
