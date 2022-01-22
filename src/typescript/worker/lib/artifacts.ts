import * as path from 'path';

import type * as ts from 'typescript';

import type { FilesMatch } from '../../../files-match';

import { getParsedConfig, parseConfig } from './config';
import { system } from './system';
import { getTsBuildInfoEmitPath } from './tsbuildinfo';
import { typescript } from './typescript';
import { config } from './worker-config';

let artifacts: FilesMatch | undefined;

export function getArtifacts(force = false): FilesMatch {
  if (!artifacts || force) {
    const parsedConfig = getParsedConfig();

    artifacts = getArtifactsWorker(parsedConfig, config.context);
  }

  return artifacts;
}

export function invalidateArtifacts() {
  artifacts = undefined;
}

export function registerArtifacts() {
  system.setArtifacts(getArtifacts());
}

function getArtifactsWorker(
  parsedConfig: ts.ParsedCommandLine,
  configFileContext: string,
  processedConfigFiles: string[] = []
): FilesMatch {
  const files = new Set<string>();
  const dirs = new Set<string>();
  if (parsedConfig.fileNames.length > 0) {
    if (parsedConfig.options.outFile) {
      files.add(path.resolve(configFileContext, parsedConfig.options.outFile));
    }
    const tsBuildInfoPath = getTsBuildInfoEmitPath(parsedConfig.options);
    if (tsBuildInfoPath) {
      files.add(path.resolve(configFileContext, tsBuildInfoPath));
    }

    if (parsedConfig.options.outDir) {
      dirs.add(path.resolve(configFileContext, parsedConfig.options.outDir));
    }
  }

  for (const projectReference of parsedConfig.projectReferences || []) {
    const configFile = typescript.resolveProjectReferencePath(projectReference);
    if (processedConfigFiles.includes(configFile)) {
      // handle circular dependencies
      continue;
    }
    const parsedConfig = parseConfig(configFile, path.dirname(configFile));
    const childArtifacts = getArtifactsWorker(parsedConfig, configFileContext, [
      ...processedConfigFiles,
      configFile,
    ]);
    childArtifacts.files.forEach((file) => {
      files.add(file);
    });
    childArtifacts.dirs.forEach((dir) => {
      dirs.add(dir);
    });
  }

  const extensions = [
    typescript.Extension.Dts,
    typescript.Extension.Js,
    typescript.Extension.TsBuildInfo,
  ];

  return {
    files: Array.from(files).map((file) => path.normalize(file)),
    dirs: Array.from(dirs).map((dir) => path.normalize(dir)),
    excluded: [],
    extensions,
  };
}
