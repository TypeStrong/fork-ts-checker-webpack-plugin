import { TypeScriptDiagnosticsOptions } from './TypeScriptDiagnosticsOptions';
import { TypeScriptVueExtensionOptions } from './extension/vue/TypeScriptVueExtensionOptions';

type TypeScriptReporterOptions =
  | boolean
  | {
      enabled?: boolean;
      memoryLimit?: number;
      tsconfig?: string;
      build?: boolean;
      mode?: 'readonly' | 'write-tsbuildinfo' | 'write-references';
      compilerOptions?: object;
      diagnosticOptions?: Partial<TypeScriptDiagnosticsOptions>;
      extensions?: {
        vue?: TypeScriptVueExtensionOptions;
      };
    };

export { TypeScriptReporterOptions };
