import * as path from 'path';

import * as semver from 'semver';
import type * as webpack from 'webpack';

import type {
  TypeScriptVueExtensionConfig,
  TypeScriptVueExtensionOptions,
} from './vue/typescript-vue-config';
import { createTypeScriptVueExtensionConfig } from './vue/typescript-vue-config';

interface TypeScriptConfigOverwrite {
  extends?: string;
  // eslint-disable-next-line
  compilerOptions?: any;
  include?: string[];
  exclude?: string[];
  files?: string[];
  references?: { path: string; prepend?: boolean }[];
}
interface TypeScriptDiagnosticsOptions {
  syntactic: boolean;
  semantic: boolean;
  declaration: boolean;
  global: boolean;
}
type TypeScriptMode = 'readonly' | 'write-tsbuildinfo' | 'write-references';

interface TypeScriptOptions {
  memoryLimit?: number;
  configFile?: string;
  configOverwrite?: TypeScriptConfigOverwrite;
  context?: string;
  build?: boolean;
  mode?: TypeScriptMode;
  diagnosticOptions?: Partial<TypeScriptDiagnosticsOptions>;
  extensions?: {
    vue?: TypeScriptVueExtensionOptions;
  };
  profile?: boolean;
  typescriptPath?: string;
}

interface TypeScriptConfig {
  enabled: boolean;
  memoryLimit: number;
  configFile: string;
  configOverwrite: TypeScriptConfigOverwrite;
  build: boolean;
  context: string;
  mode: TypeScriptMode;
  diagnosticOptions: TypeScriptDiagnosticsOptions;
  extensions: {
    vue: TypeScriptVueExtensionConfig;
  };
  profile: boolean;
  typescriptPath: string;
}

function createTypeScriptConfig(
  compiler: webpack.Compiler,
  options: TypeScriptOptions | undefined
): TypeScriptConfig {
  let configFile =
    typeof options === 'object' ? options.configFile || 'tsconfig.json' : 'tsconfig.json';

  // ensure that `configFile` is an absolute normalized path
  configFile = path.normalize(
    path.isAbsolute(configFile)
      ? configFile
      : path.resolve(compiler.options.context || process.cwd(), configFile)
  );

  const optionsAsObject: Exclude<TypeScriptOptions, boolean> =
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

export {
  TypeScriptConfigOverwrite,
  TypeScriptDiagnosticsOptions,
  TypeScriptOptions,
  createTypeScriptConfig,
  TypeScriptConfig,
};
