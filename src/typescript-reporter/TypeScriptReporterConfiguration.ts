import webpack from 'webpack';
import path from 'path';
import ts from 'typescript';
import { TypeScriptDiagnosticsOptions } from './TypeScriptDiagnosticsOptions';
import { TypeScriptReporterOptions } from './TypeScriptReporterOptions';
import {
  createTypeScriptVueExtensionConfiguration,
  TypeScriptVueExtensionConfiguration,
} from './extension/vue/TypeScriptVueExtensionConfiguration';
import normalizeSlash from '../utils/path/normalizeSlash';

interface TypeScriptReporterConfiguration {
  enabled: boolean;
  memoryLimit: number;
  tsconfig: string;
  build: boolean;
  compilerOptions: Partial<ts.CompilerOptions>;
  diagnosticOptions: TypeScriptDiagnosticsOptions;
  extensions: {
    vue: TypeScriptVueExtensionConfiguration;
  };
}

function createTypeScriptReporterConfiguration(
  compiler: webpack.Compiler,
  options: TypeScriptReporterOptions | undefined
): TypeScriptReporterConfiguration {
  let tsconfig: string =
    typeof options === 'object' ? options.tsconfig || 'tsconfig.json' : 'tsconfig.json';

  // ensure that `tsconfig` is an absolute path with normalized slash
  tsconfig = normalizeSlash(
    path.isAbsolute(tsconfig)
      ? tsconfig
      : path.resolve(compiler.options.context || process.cwd(), tsconfig)
  );

  // convert json compilerOptions to ts.CompilerOptions
  const convertResults = ts.convertCompilerOptionsFromJson(
    {
      skipDefaultLibCheck: true,
      skipLibCheck: true,
      ...(typeof options === 'object' ? options.compilerOptions || {} : {}),
    },
    compiler.options.context || process.cwd(),
    tsconfig
  );
  const convertedOptions = convertResults.options || {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { configFilePath, ...compilerOptions } = convertedOptions;

  return {
    enabled: options !== false,
    memoryLimit: 2048,
    build: false,
    ...(typeof options === 'object' ? options : {}),
    tsconfig: tsconfig,
    compilerOptions: compilerOptions,
    extensions: {
      vue: createTypeScriptVueExtensionConfiguration(
        typeof options === 'object' && options.extensions ? options.extensions.vue : undefined
      ),
    },
    diagnosticOptions: {
      syntactic: false, // by default they are reported by the loader
      semantic: true,
      declaration: false,
      global: false,
      ...((typeof options === 'object' && options.diagnosticOptions) || {}),
    },
  };
}

export { createTypeScriptReporterConfiguration, TypeScriptReporterConfiguration };
