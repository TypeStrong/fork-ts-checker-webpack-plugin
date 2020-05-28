import webpack from 'webpack';
import path from 'path';
import { TypeScriptDiagnosticsOptions } from './TypeScriptDiagnosticsOptions';
import { TypeScriptReporterOptions } from './TypeScriptReporterOptions';
import {
  createTypeScriptVueExtensionConfiguration,
  TypeScriptVueExtensionConfiguration,
} from './extension/vue/TypeScriptVueExtensionConfiguration';

interface TypeScriptReporterConfiguration {
  enabled: boolean;
  memoryLimit: number;
  tsconfig: string;
  build: boolean;
  context: string;
  mode: 'readonly' | 'write-tsbuildinfo' | 'write-references';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compilerOptions: any;
  diagnosticOptions: TypeScriptDiagnosticsOptions;
  extensions: {
    vue: TypeScriptVueExtensionConfiguration;
  };
}

function createTypeScriptReporterConfiguration(
  compiler: webpack.Compiler,
  options: TypeScriptReporterOptions | undefined
): TypeScriptReporterConfiguration {
  let tsconfig =
    typeof options === 'object' ? options.tsconfig || 'tsconfig.json' : 'tsconfig.json';

  // ensure that `tsconfig` is an absolute normalized path
  tsconfig = path.normalize(
    path.isAbsolute(tsconfig)
      ? tsconfig
      : path.resolve(compiler.options.context || process.cwd(), tsconfig)
  );

  const optionsAsObject: Exclude<TypeScriptReporterOptions, boolean> =
    typeof options === 'object' ? options : {};

  return {
    enabled: options !== false,
    memoryLimit: 2048,
    build: false,
    mode: 'readonly',
    ...optionsAsObject,
    tsconfig: tsconfig,
    context: optionsAsObject.context || path.dirname(tsconfig),
    compilerOptions: {
      skipDefaultLibCheck: true,
      skipLibCheck: true,
      ...(optionsAsObject.compilerOptions || {}),
    },
    extensions: {
      vue: createTypeScriptVueExtensionConfiguration(
        optionsAsObject.extensions ? optionsAsObject.extensions.vue : undefined
      ),
    },
    diagnosticOptions: {
      syntactic: false, // by default they are reported by the loader
      semantic: true,
      declaration: false,
      global: false,
      ...(optionsAsObject.diagnosticOptions || {}),
    },
  };
}

export { createTypeScriptReporterConfiguration, TypeScriptReporterConfiguration };
