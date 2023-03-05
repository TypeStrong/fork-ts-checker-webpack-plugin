import * as path from 'path';

import type * as ts from 'typescript';

import type { FilesChange } from '../../../files-change';
import type { FilesMatch } from '../../../files-match';
import type { Issue } from '../../../issue';
import { forwardSlash } from '../../../utils/path/forward-slash';
import type { TypeScriptConfigOverwrite } from '../../type-script-config-overwrite';

import { createIssuesFromDiagnostics } from './diagnostics';
import { system } from './system';
import { typescript } from './typescript';
import { config } from './worker-config';

let parsedConfig: ts.ParsedCommandLine | undefined;
let parseConfigDiagnostics: ts.Diagnostic[] = [];

// initialize ParseConfigFileHost
const parseConfigFileHost: ts.ParseConfigFileHost = {
  ...system,
  onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
    parseConfigDiagnostics.push(diagnostic);
  },
};

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
    compilerOptions: baseCompilerOptionsOverwrite,
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

export function parseConfig(
  configFileName: string,
  configFileContext: string
): ts.ParsedCommandLine {
  const configFilePath = forwardSlash(configFileName);

  const { config: baseConfig, error: readConfigError } = typescript.readConfigFile(
    configFilePath,
    parseConfigFileHost.readFile
  );

  const overwrittenConfig = applyConfigOverwrite(
    baseConfig || {},
    getImplicitConfigOverwrite(),
    getUserProvidedConfigOverwrite()
  );

  const parsedConfigFile = typescript.parseJsonConfigFileContent(
    overwrittenConfig,
    parseConfigFileHost,
    configFileContext
  );

  return {
    ...parsedConfigFile,
    options: {
      ...parsedConfigFile.options,
      configFilePath: configFilePath,
    },
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

export function parseNextConfig() {
  const prevParsedConfig = parsedConfig;
  const nextParsedConfig = getParsedConfig(true);

  return [prevParsedConfig, nextParsedConfig] as const;
}

export function invalidateConfig() {
  parsedConfig = undefined;
  parseConfigDiagnostics = [];
}

export function getConfigFilePathFromCompilerOptions(compilerOptions: ts.CompilerOptions): string {
  return compilerOptions.configFilePath as unknown as string;
}

export function getConfigFilePathFromProgram(program: ts.Program): string {
  return getConfigFilePathFromCompilerOptions(program.getCompilerOptions());
}

export function getConfigFilePathFromBuilderProgram(builderProgram: ts.BuilderProgram): string {
  return getConfigFilePathFromCompilerOptions(builderProgram.getProgram().getCompilerOptions());
}

export function didConfigFileChanged({ changedFiles = [], deletedFiles = [] }: FilesChange) {
  return [...changedFiles, ...deletedFiles]
    .map((file) => path.normalize(file))
    .includes(path.normalize(config.configFile));
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

export function didRootFilesChanged() {
  const [prevConfig, nextConfig] = parseNextConfig();

  return (
    prevConfig && JSON.stringify(prevConfig.fileNames) !== JSON.stringify(nextConfig.fileNames)
  );
}
