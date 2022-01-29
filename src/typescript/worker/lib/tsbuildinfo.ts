import * as path from 'path';

import type * as ts from 'typescript';

import { getParsedConfig } from './config';
import { system } from './system';
import { typescript } from './typescript';
import { config } from './worker-config';

export function invalidateTsBuildInfo() {
  const parsedConfig = getParsedConfig();

  // try to remove outdated .tsbuildinfo file for incremental mode
  if (
    typeof typescript.getTsBuildInfoEmitOutputFilePath === 'function' &&
    config.mode !== 'readonly' &&
    parsedConfig.options.incremental
  ) {
    const tsBuildInfoPath = typescript.getTsBuildInfoEmitOutputFilePath(parsedConfig.options);
    if (tsBuildInfoPath) {
      try {
        system.deleteFile(tsBuildInfoPath);
      } catch (error) {
        // silent
      }
    }
  }
}

export function emitTsBuildInfoIfNeeded(builderProgram: ts.BuilderProgram) {
  const parsedConfig = getParsedConfig();

  if (config.mode !== 'readonly' && parsedConfig && isIncrementalEnabled(parsedConfig.options)) {
    const program = builderProgram.getProgram();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (program as any).emitBuildInfo === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program as any).emitBuildInfo();
    }
  }
}

export function getTsBuildInfoEmitPath(compilerOptions: ts.CompilerOptions) {
  if (typeof typescript.getTsBuildInfoEmitOutputFilePath === 'function') {
    return typescript.getTsBuildInfoEmitOutputFilePath(compilerOptions);
  }

  const removeJsonExtension = (filePath: string) =>
    filePath.endsWith('.json') ? filePath.slice(0, -'.json'.length) : filePath;

  // based on the implementation from typescript
  const configFile = compilerOptions.configFilePath as string;
  if (!isIncrementalEnabled(compilerOptions)) {
    return undefined;
  }
  if (compilerOptions.tsBuildInfoFile) {
    return compilerOptions.tsBuildInfoFile;
  }
  const outPath = compilerOptions.outFile || compilerOptions.out;
  let buildInfoExtensionLess;
  if (outPath) {
    buildInfoExtensionLess = removeJsonExtension(outPath);
  } else {
    if (!configFile) {
      return undefined;
    }
    const configFileExtensionLess = removeJsonExtension(configFile);
    buildInfoExtensionLess = compilerOptions.outDir
      ? compilerOptions.rootDir
        ? path.resolve(
            compilerOptions.outDir,
            path.relative(compilerOptions.rootDir, configFileExtensionLess)
          )
        : path.resolve(compilerOptions.outDir, path.basename(configFileExtensionLess))
      : configFileExtensionLess;
  }
  return buildInfoExtensionLess + '.tsbuildinfo';
}

function isIncrementalEnabled(compilerOptions: ts.CompilerOptions) {
  return Boolean(
    (compilerOptions.incremental || compilerOptions.composite) && !compilerOptions.outFile
  );
}
