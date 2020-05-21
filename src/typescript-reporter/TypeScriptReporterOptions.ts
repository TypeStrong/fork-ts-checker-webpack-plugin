import { TypeScriptDiagnosticsOptions } from './TypeScriptDiagnosticsOptions';
import { TypeScriptVueExtensionOptions } from './extension/vue/TypeScriptVueExtensionOptions';
import { TypeScriptPnpExtensionOptions } from './extension/pnp/TypeScriptPnpExtensionOptions';

type TypeScriptReporterOptions =
  | boolean
  | {
      enabled?: boolean;
      memoryLimit?: number;
      tsconfig?: string;
      compilerOptions?: object;
      diagnosticOptions?: Partial<TypeScriptDiagnosticsOptions>;
      extensions?: {
        vue?: TypeScriptVueExtensionOptions;
        pnp?: TypeScriptPnpExtensionOptions;
      };
    };

export { TypeScriptReporterOptions };
