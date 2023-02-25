import path from 'path';

import type webpack from 'webpack';

import type { TypeScriptConfigOverwrite } from './type-script-config-overwrite';
import type { TypeScriptDiagnosticsOptions } from './type-script-diagnostics-options';
import type { TypeScriptWorkerOptions } from './type-script-worker-options';

interface TypeScriptWorkerConfig {
  enabled: boolean;
  memoryLimit: number;
  configFile: string;
  configOverwrite: TypeScriptConfigOverwrite;
  build: boolean;
  context: string;
  mode: 'readonly' | 'write-dts' | 'write-tsbuildinfo' | 'write-references';
  diagnosticOptions: TypeScriptDiagnosticsOptions;
  profile: boolean;
  typescriptPath: string;
}

function createTypeScriptWorkerConfig(
  compiler: webpack.Compiler,
  options: TypeScriptWorkerOptions | undefined
): TypeScriptWorkerConfig {
  let configFile =
    typeof options === 'object' ? options.configFile || 'tsconfig.json' : 'tsconfig.json';

  // ensure that `configFile` is an absolute normalized path
  configFile = path.normalize(
    path.isAbsolute(configFile)
      ? configFile
      : path.resolve(compiler.options.context || process.cwd(), configFile)
  );

  const optionsAsObject: Exclude<TypeScriptWorkerOptions, boolean> =
    typeof options === 'object' ? options : {};

  const typescriptPath = optionsAsObject.typescriptPath || require.resolve('typescript');

  return {
    enabled: options !== false,
    memoryLimit: 2048,
    build: false,
    mode: optionsAsObject.build ? 'write-tsbuildinfo' : 'readonly',
    profile: false,
    ...optionsAsObject,
    configFile: configFile,
    configOverwrite: optionsAsObject.configOverwrite || {},
    context: optionsAsObject.context || path.dirname(configFile),
    diagnosticOptions: {
      syntactic: false, // by default they are reported by the loader
      semantic: true,
      declaration: false,
      global: false,
      ...(optionsAsObject.diagnosticOptions || {}),
    },
    typescriptPath: typescriptPath,
  };
}

export { createTypeScriptWorkerConfig, TypeScriptWorkerConfig };
