import path from 'path';

import semver from 'semver';
import type webpack from 'webpack';

import type { TypeScriptVueExtensionConfig } from './extension/vue/type-script-vue-extension-config';
import { createTypeScriptVueExtensionConfig } from './extension/vue/type-script-vue-extension-config';
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
  mode: 'readonly' | 'write-tsbuildinfo' | 'write-references';
  diagnosticOptions: TypeScriptDiagnosticsOptions;
  extensions: {
    vue: TypeScriptVueExtensionConfig;
  };
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

  const defaultCompilerOptions: Record<string, unknown> = {
    skipLibCheck: true,
    sourceMap: false,
    inlineSourceMap: false,
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  if (semver.gte(require(typescriptPath).version, '2.9.0')) {
    defaultCompilerOptions.declarationMap = false;
  }

  return {
    enabled: options !== false,
    memoryLimit: 2048,
    build: false,
    mode: 'write-tsbuildinfo',
    profile: false,
    ...optionsAsObject,
    configFile: configFile,
    configOverwrite: {
      ...(optionsAsObject.configOverwrite || {}),
      compilerOptions: {
        ...defaultCompilerOptions,
        ...((optionsAsObject.configOverwrite || {}).compilerOptions || {}),
      },
    },
    context: optionsAsObject.context || path.dirname(configFile),
    extensions: {
      vue: createTypeScriptVueExtensionConfig(
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
    typescriptPath: typescriptPath,
  };
}

export { createTypeScriptWorkerConfig, TypeScriptWorkerConfig };
