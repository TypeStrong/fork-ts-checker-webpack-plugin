import webpack from 'webpack';
import path from 'path';
import { CompilerOptions as TypeScriptCompilerOptions } from 'typescript';
import { TypeScriptDiagnosticsOptions } from './TypeScriptDiagnosticsOptions';
import { TypeScriptReporterOptions } from './TypeScriptReporterOptions';
import {
  createTypeScriptVueExtensionConfiguration,
  TypeScriptVueExtensionConfiguration,
} from './extension/vue/TypeScriptVueExtensionConfiguration';
import {
  createTypeScriptPnpExtensionConfiguration,
  TypeScriptPnpExtensionConfiguration,
} from './extension/pnp/TypeScriptPnpExtensionConfiguration';
import normalizeSlash from '../utils/path/normalizeSlash';

interface TypeScriptReporterConfiguration {
  enabled: boolean;
  memoryLimit: number;
  tsconfig: string;
  build: boolean;
  compilerOptions: Partial<TypeScriptCompilerOptions>;
  diagnosticOptions: TypeScriptDiagnosticsOptions;
  extensions: {
    vue: TypeScriptVueExtensionConfiguration;
    pnp: TypeScriptPnpExtensionConfiguration;
  };
}

function createTypeScriptReporterConfiguration(
  compiler: webpack.Compiler,
  options: TypeScriptReporterOptions | undefined
): TypeScriptReporterConfiguration {
  const configuration: TypeScriptReporterConfiguration = {
    enabled: options !== false,
    memoryLimit: 2048,
    tsconfig: 'tsconfig.json',
    build: false,
    ...(typeof options === 'object' ? options : {}),
    compilerOptions: {
      skipDefaultLibCheck: true,
      skipLibCheck: true,
      ...(typeof options === 'object' ? options.compilerOptions || {} : {}),
    },
    extensions: {
      vue: createTypeScriptVueExtensionConfiguration(
        typeof options === 'object' && options.extensions ? options.extensions.vue : undefined
      ),
      pnp: createTypeScriptPnpExtensionConfiguration(
        typeof options === 'object' && options.extensions ? options.extensions.pnp : undefined
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

  // ensure that `typescript.tsconfig` is an absolute path with normalized slash
  configuration.tsconfig = normalizeSlash(
    path.isAbsolute(configuration.tsconfig)
      ? configuration.tsconfig
      : path.resolve(compiler.options.context || process.cwd(), configuration.tsconfig)
  );

  return configuration;
}

export { createTypeScriptReporterConfiguration, TypeScriptReporterConfiguration };
