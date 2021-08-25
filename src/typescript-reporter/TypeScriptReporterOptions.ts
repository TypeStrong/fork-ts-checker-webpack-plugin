import { TypeScriptDiagnosticsOptions } from './TypeScriptDiagnosticsOptions';
import { TypeScriptVueExtensionOptions } from './extension/vue/TypeScriptVueExtensionOptions';
import { TypeScriptConfigurationOverwrite } from './TypeScriptConfigurationOverwrite';

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
