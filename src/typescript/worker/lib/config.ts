import * as path from 'path';

import type * as ts from 'typescript';

import type { FilesChange } from '../../../files-change';
import type { Issue } from '../../../issue';
import { forwardSlash } from '../../../utils/path/forward-slash';
import type { TypeScriptConfigOverwrite } from '../../type-script-config-overwrite';

import { createIssuesFromDiagnostics } from './diagnostics';
import { extensions } from './extensions';
import { system } from './system';
import { typescript } from './typescript';
import { config } from './worker-config';

let parsedConfig: ts.ParsedCommandLine | undefined;
let parseConfigDiagnostics: ts.Diagnostic[] = [];

// initialize ParseConfigFileHost
let parseConfigFileHost: ts.ParseConfigFileHost = {
  ...system,
  onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
    parseConfigDiagnostics.push(diagnostic);
  },
};
for (const extension of extensions) {
  if (extension.extendParseConfigFileHost) {
    parseConfigFileHost = extension.extendParseConfigFileHost(parseConfigFileHost);
  }
}

export function parseConfig(
  configFileName: string,
  configFileContext: string,
  configOverwriteJSON: TypeScriptConfigOverwrite = {}
): ts.ParsedCommandLine {
  const configFilePath = forwardSlash(configFileName);
  const parsedConfigFileJSON = typescript.readConfigFile(
    configFilePath,
    parseConfigFileHost.readFile
  );

  const overwrittenConfigFileJSON = {
    ...(parsedConfigFileJSON.config || {}),
    ...configOverwriteJSON,
    compilerOptions: {
      ...((parsedConfigFileJSON.config || {}).compilerOptions || {}),
      ...(configOverwriteJSON.compilerOptions || {}),
    },
  };

  const parsedConfigFile = typescript.parseJsonConfigFileContent(
    overwrittenConfigFileJSON,
    parseConfigFileHost,
    configFileContext
  );

  return {
    ...parsedConfigFile,
    options: {
      ...parsedConfigFile.options,
      configFilePath: configFilePath,
    },
    errors: parsedConfigFileJSON.error ? [parsedConfigFileJSON.error] : parsedConfigFile.errors,
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
    parseConfigDiagnostics = [];

    parsedConfig = parseConfig(config.configFile, config.context, config.configOverwrite);

    const configFilePath = forwardSlash(config.configFile);
    const parsedConfigFileJSON = typescript.readConfigFile(
      configFilePath,
      parseConfigFileHost.readFile
    );
    const overwrittenConfigFileJSON = {
      ...(parsedConfigFileJSON.config || {}),
      ...config.configOverwrite,
      compilerOptions: {
        ...((parsedConfigFileJSON.config || {}).compilerOptions || {}),
        ...(config.configOverwrite.compilerOptions || {}),
      },
    };
    parsedConfig = typescript.parseJsonConfigFileContent(
      overwrittenConfigFileJSON,
      parseConfigFileHost,
      config.context
    );
    parsedConfig.options.configFilePath = configFilePath;
    parsedConfig.errors = parsedConfigFileJSON.error
      ? [parsedConfigFileJSON.error]
      : parsedConfig.errors;

    if (parsedConfig.errors) {
      parseConfigDiagnostics.push(...parsedConfig.errors);
    }
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

export function didRootFilesChanged() {
  const [prevConfig, nextConfig] = parseNextConfig();

  return (
    prevConfig && JSON.stringify(prevConfig.fileNames) !== JSON.stringify(nextConfig.fileNames)
  );
}
