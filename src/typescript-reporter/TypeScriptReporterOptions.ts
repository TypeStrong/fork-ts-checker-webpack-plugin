import { CompilerOptions as TypeScriptCompilerOptions } from 'typescript';
import { TypeScriptDiagnosticsOptions } from './TypeScriptDiagnosticsOptions';
import { TypeScriptVueExtensionOptions } from './extension/vue/TypeScriptVueExtensionOptions';
import { TypeScriptPnpExtensionOptions } from './extension/pnp/TypeScriptPnpExtensionOptions';

type TypeScriptReporterOptions =
  | boolean
  | {
      enabled?: boolean;
      memoryLimit?: number;
      tsconfig?: string;
      compilerOptions?: Partial<TypeScriptCompilerOptions>;
      diagnosticOptions?: Partial<TypeScriptDiagnosticsOptions>;
      extensions?: {
        vue?: TypeScriptVueExtensionOptions;
        pnp?: TypeScriptPnpExtensionOptions;
      };
    };

export { TypeScriptReporterOptions };
