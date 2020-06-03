import webpack from 'webpack';
import path from 'path';
import * as ts from 'typescript';
import semver from 'semver';
import { TypeScriptDiagnosticsOptions } from './TypeScriptDiagnosticsOptions';
import { TypeScriptReporterOptions } from './TypeScriptReporterOptions';
import {
  createTypeScriptVueExtensionConfiguration,
  TypeScriptVueExtensionConfiguration,
} from './extension/vue/TypeScriptVueExtensionConfiguration';

interface TypeScriptReporterConfiguration {
  enabled: boolean;
  memoryLimit: number;
  configFile: string;
  build: boolean;
  context: string;
  mode: 'readonly' | 'write-tsbuildinfo' | 'write-references';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compilerOptions: any;
  diagnosticOptions: TypeScriptDiagnosticsOptions;
  extensions: {
    vue: TypeScriptVueExtensionConfiguration;
  };
  profile: boolean;
}

function createTypeScriptReporterConfiguration(
  compiler: webpack.Compiler,
  options: TypeScriptReporterOptions | undefined
): TypeScriptReporterConfiguration {
  let configFile =
    typeof options === 'object' ? options.configFile || 'tsconfig.json' : 'tsconfig.json';

  // ensure that `configFile` is an absolute normalized path
  configFile = path.normalize(
    path.isAbsolute(configFile)
      ? configFile
      : path.resolve(compiler.options.context || process.cwd(), configFile)
  );

  const optionsAsObject: Exclude<TypeScriptReporterOptions, boolean> =
    typeof options === 'object' ? options : {};

  const defaultCompilerOptions: Record<string, unknown> = {
    skipLibCheck: true,
    sourceMap: false,
    inlineSourceMap: false,
  };
  if (semver.gte(ts.version, '2.9.0')) {
    defaultCompilerOptions.declarationMap = false;
  }
  if (semver.gte(ts.version, '3.4.0')) {
    defaultCompilerOptions.incremental = true;
  }

  return {
    enabled: options !== false,
    memoryLimit: 2048,
    build: false,
    mode: 'write-tsbuildinfo',
    profile: false,
    ...optionsAsObject,
    configFile: configFile,
    context: optionsAsObject.context || path.dirname(configFile),
    compilerOptions: {
      ...defaultCompilerOptions,
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
