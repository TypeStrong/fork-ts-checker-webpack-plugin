import path from 'path';

import type * as webpack from 'webpack';

import { getInfrastructureLogger } from '../infrastructure-logger';

import type { TypeScriptConfigOverwrite } from './type-script-config-overwrite';
import type { TypeScriptDiagnosticsOptions } from './type-script-diagnostics-options';
import type { TypeScriptWorkerOptions } from './type-script-worker-options';

interface TypeScriptWorkerConfig {
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
  let configFile = options?.configFile || 'tsconfig.json';

  // ensure that `configFile` is an absolute normalized path
  configFile = path.normalize(
    path.isAbsolute(configFile)
      ? configFile
      : path.resolve(compiler.options.context || process.cwd(), configFile)
  );

  const optionsAsObject: Exclude<TypeScriptWorkerOptions, boolean> =
    typeof options === 'object' ? options : {};

  const typescriptPath = optionsAsObject.typescriptPath || require.resolve('typescript');

  const build = Boolean(optionsAsObject.build);
  let mode = optionsAsObject.mode || (build ? 'write-tsbuildinfo' : 'readonly');
  if (!build && (mode === 'write-tsbuildinfo' || mode === 'write-references')) {
    // only the build orchestrator writes these files - without it nothing is
    // emitted, and asking for emit would only add emit-only errors like TS5011
    getInfrastructureLogger(compiler).warn(
      `The "${mode}" mode requires the "build" option - falling back to the "readonly" mode.`
    );
    mode = 'readonly';
  }

  return {
    memoryLimit: 2048,
    profile: false,
    ...optionsAsObject,
    build,
    mode,
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
