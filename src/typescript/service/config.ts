import * as path from 'path';

import type { CompilerOptions, Diagnostic, ParsedCommandLine } from 'typescript/async';

import type { FilesChange } from '../../files-change';
import type { FilesMatch } from '../../files-match';
import type { Issue } from '../../issue';
import type { TypeScriptConfigOverwrite } from '../type-script-config-overwrite';
import type { TypeScriptWorkerConfig } from '../type-script-worker-config';

import type { ApiHost } from './api';
import { createIssuesFromDiagnostics } from './diagnostics';

/**
 * The implicit overrides that apply both to a program and to the build
 * orchestrator, which only accepts a small set of options.
 */
export function getSharedImplicitCompilerOptions(config: TypeScriptWorkerConfig) {
  return {
    sourceMap: false,
    inlineSourceMap: false,
    ...(config.mode === 'write-dts' ? { declaration: true } : {}),
  };
}

function applyConfigOverwrite(
  baseConfig: TypeScriptConfigOverwrite,
  ...overwriteConfigs: TypeScriptConfigOverwrite[]
): TypeScriptConfigOverwrite {
  let config = baseConfig;

  for (const overwriteConfig of overwriteConfigs) {
    config = {
      ...(config || {}),
      ...(overwriteConfig || {}),
      compilerOptions: {
        ...(config?.compilerOptions || {}),
        ...(overwriteConfig?.compilerOptions || {}),
      },
    };
  }

  return config;
}

/**
 * The plugin turns off the "sourceMap" and the "inlineSourceMap" options. Options that depend on
 * them would become invalid, so we remove them as well.
 */
function removeOrphanedSourceMapOptions(options: CompilerOptions): CompilerOptions {
  const { inlineSources, sourceRoot, mapRoot, ...otherOptions } = options;

  return {
    ...otherOptions,
    ...(options.sourceMap || options.inlineSourceMap ? { inlineSources, sourceRoot } : {}),
    ...(options.sourceMap || options.declarationMap ? { mapRoot } : {}),
  };
}

export function didConfigFileChanged(
  { changedFiles = [], deletedFiles = [] }: FilesChange,
  configFiles: readonly string[]
) {
  return [...changedFiles, ...deletedFiles]
    .map((file) => path.normalize(file))
    .some((file) => configFiles.includes(file));
}

export function didDependenciesProbablyChanged(
  dependencies: FilesMatch,
  { changedFiles = [], deletedFiles = [] }: FilesChange
) {
  const didSomeDependencyHasBeenAdded = changedFiles.some(
    (changeFile) => !dependencies.files.includes(changeFile)
  );
  const didSomeDependencyHasBeenDeleted = deletedFiles.some((deletedFile) =>
    dependencies.files.includes(deletedFile)
  );

  return didSomeDependencyHasBeenAdded || didSomeDependencyHasBeenDeleted;
}

export interface ConfigStore {
  parseConfig(configFileName: string, configFileContext: string): Promise<ParsedCommandLine>;
  /** The parsed root config file, with the overrides applied. */
  getParsedConfig(): Promise<ParsedCommandLine>;
  getParseConfigIssues(): Issue[];
  didRootFilesChanged(previousRootFiles: readonly string[]): Promise<boolean>;
  invalidateConfig(): void;
}

export function createConfigStore(
  config: TypeScriptWorkerConfig,
  { getApi }: ApiHost
): ConfigStore {
  let parsedConfig: ParsedCommandLine | undefined;
  let parseConfigDiagnostics: Diagnostic[] = [];

  function getUserProvidedConfigOverwrite(): TypeScriptConfigOverwrite {
    return config.configOverwrite || {};
  }

  function getImplicitConfigOverwrite(): TypeScriptConfigOverwrite {
    const baseCompilerOptionsOverwrite = {
      skipLibCheck: true,
      ...getSharedImplicitCompilerOptions(config),
    };

    switch (config.mode) {
      case 'write-dts':
        return {
          compilerOptions: {
            ...baseCompilerOptionsOverwrite,
            emitDeclarationOnly: true,
            noEmit: false,
          },
        };
      // these two modes are only kept with the `build` option
      case 'write-tsbuildinfo':
      case 'write-references':
        return {
          compilerOptions: {
            ...baseCompilerOptionsOverwrite,
            declaration: true,
            emitDeclarationOnly: false,
            noEmit: false,
          },
        };
    }

    return {
      compilerOptions: {
        ...baseCompilerOptionsOverwrite,
        // nothing is emitted, and without it emit-only option diagnostics
        // (like TS5011 for a missing `rootDir`) are reported, unlike `tsc --noEmit`
        noEmit: true,
      },
    };
  }

  async function parseConfig(
    configFileName: string,
    configFileContext: string
  ): Promise<ParsedCommandLine> {
    const api = getApi();
    const { config: baseConfig, error: readConfigError } = await api.readConfigFile(configFileName);

    const overwrittenConfig = applyConfigOverwrite(
      (baseConfig as TypeScriptConfigOverwrite) || {},
      getImplicitConfigOverwrite(),
      getUserProvidedConfigOverwrite()
    );

    // the API resolves relative paths against the config file's directory unless
    // we give it an explicit base directory - that's what the `context` option is for
    const parsedConfigFile = await api.parseJsonConfigFileContent(
      overwrittenConfig,
      path.normalize(configFileContext) === path.normalize(path.dirname(configFileName))
        ? { configFileName }
        : { configDirectory: configFileContext }
    );

    return {
      ...parsedConfigFile,
      options: removeOrphanedSourceMapOptions(parsedConfigFile.options),
      errors: readConfigError ? [readConfigError] : parsedConfigFile.errors,
    };
  }

  function getParseConfigIssues(): Issue[] {
    const issues = createIssuesFromDiagnostics(parseConfigDiagnostics);

    issues.forEach((issue) => {
      if (!issue.file) {
        issue.file = config.configFile;
      }
    });

    return issues;
  }

  async function getParsedConfig(): Promise<ParsedCommandLine> {
    if (!parsedConfig) {
      parsedConfig = await parseConfig(config.configFile, config.context);
      parseConfigDiagnostics = parsedConfig.errors || [];
    }

    return parsedConfig;
  }

  function invalidateConfig() {
    parsedConfig = undefined;
    parseConfigDiagnostics = [];
  }

  async function didRootFilesChanged(previousRootFiles: readonly string[]) {
    const previous = new Set(previousRootFiles);
    const next = new Set((await getParsedConfig()).fileNames);

    return previous.size !== next.size || [...next].some((fileName) => !previous.has(fileName));
  }

  return {
    parseConfig,
    getParsedConfig,
    getParseConfigIssues,
    didRootFilesChanged,
    invalidateConfig,
  };
}
