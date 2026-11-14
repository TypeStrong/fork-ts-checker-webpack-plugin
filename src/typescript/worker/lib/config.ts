import * as path from 'path';

import type { Diagnostic, ParsedCommandLine } from 'typescript/sync';

import type { FilesChange } from '../../../files-change';
import type { FilesMatch } from '../../../files-match';
import type { Issue } from '../../../issue';
import type { TypeScriptConfigOverwrite } from '../../type-script-config-overwrite';

import { getApi } from './api';
import { createIssuesFromDiagnostics } from './diagnostics';
import { config } from './worker-config';

let parsedConfig: ParsedCommandLine | undefined;
let parseConfigDiagnostics: Diagnostic[] = [];

function getUserProvidedConfigOverwrite(): TypeScriptConfigOverwrite {
  return config.configOverwrite || {};
}

function getImplicitConfigOverwrite(): TypeScriptConfigOverwrite {
  const baseCompilerOptionsOverwrite = {
    skipLibCheck: true,
    sourceMap: false,
    inlineSourceMap: false,
  };

  switch (config.mode) {
    case 'write-dts':
      return {
        compilerOptions: {
          ...baseCompilerOptionsOverwrite,
          declaration: true,
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

export function parseConfig(configFileName: string, configFileContext: string): ParsedCommandLine {
  const api = getApi();
  const { config: baseConfig, error: readConfigError } = api.readConfigFile(configFileName);

  const overwrittenConfig = applyConfigOverwrite(
    (baseConfig as TypeScriptConfigOverwrite) || {},
    getImplicitConfigOverwrite(),
    getUserProvidedConfigOverwrite()
  );

  // the API resolves relative paths against the config file's directory unless
  // we give it an explicit base directory - that's what the `context` option is for
  const parsedConfigFile = api.parseJsonConfigFileContent(
    overwrittenConfig,
    path.normalize(configFileContext) === path.normalize(path.dirname(configFileName))
      ? { configFileName }
      : { configDirectory: configFileContext }
  );

  return {
    ...parsedConfigFile,
    errors: readConfigError ? [readConfigError] : parsedConfigFile.errors,
  };
}

export function getParseConfigIssues(): Issue[] {
  const issues = createIssuesFromDiagnostics(parseConfigDiagnostics);

  issues.forEach((issue) => {
    if (!issue.file) {
      issue.file = config.configFile;
    }
  });

  return issues;
}

export function getParsedConfig(force = false) {
  if (!parsedConfig || force) {
    parsedConfig = parseConfig(config.configFile, config.context);
    parseConfigDiagnostics = parsedConfig.errors || [];
  }

  return parsedConfig;
}

export function invalidateConfig() {
  parsedConfig = undefined;
  parseConfigDiagnostics = [];
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

export function didRootFilesChanged(previousRootFiles: readonly string[]) {
  return JSON.stringify(previousRootFiles) !== JSON.stringify(getParsedConfig().fileNames);
}
