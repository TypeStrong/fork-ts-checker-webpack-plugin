import * as path from 'path';

import type * as ts from 'typescript';

import type { FilesMatch } from '../../../files-match';

import { getParsedConfig, parseConfig } from './config';
import { typescript } from './typescript';
import { config } from './worker-config';

let dependencies: FilesMatch | undefined;

export function getDependencies(force = false): FilesMatch {
  if (!dependencies || force) {
    const parsedConfig = getParsedConfig();

    dependencies = getDependenciesWorker(parsedConfig, config.context);
  }

  return dependencies;
}

export function invalidateDependencies() {
  dependencies = undefined;
}

function getDependenciesWorker(
  parsedConfig: ts.ParsedCommandLine,
  configFileContext: string,
  processedConfigFiles: string[] = []
): FilesMatch {
  const files = new Set<string>(parsedConfig.fileNames);
  const configFilePath = parsedConfig.options.configFilePath;
  if (typeof configFilePath === 'string') {
    files.add(configFilePath);
  }
  const dirs = new Set(Object.keys(parsedConfig.wildcardDirectories || {}));
  const excluded = new Set<string>(
    (parsedConfig.raw?.exclude || []).map((filePath: string) =>
      path.resolve(configFileContext, filePath)
    )
  );

  for (const projectReference of parsedConfig.projectReferences || []) {
    const childConfigFilePath = typescript.resolveProjectReferencePath(projectReference);
    const childConfigContext = path.dirname(childConfigFilePath);
    if (processedConfigFiles.includes(childConfigFilePath)) {
      // handle circular dependencies
      continue;
    }
    const childParsedConfig = parseConfig(childConfigFilePath, childConfigContext);
    const childDependencies = getDependenciesWorker(childParsedConfig, childConfigContext, [
      ...processedConfigFiles,
      childConfigFilePath,
    ]);
    childDependencies.files.forEach((file) => {
      files.add(file);
    });
    childDependencies.dirs.forEach((dir) => {
      dirs.add(dir);
    });
  }

  const extensions = [
    typescript.Extension.Ts,
    typescript.Extension.Tsx,
    typescript.Extension.Js,
    typescript.Extension.Jsx,
    typescript.Extension.TsBuildInfo,
  ];

  return {
    files: Array.from(files).map((file) => path.normalize(file)),
    dirs: Array.from(dirs).map((dir) => path.normalize(dir)),
    excluded: Array.from(excluded).map((aPath) => path.normalize(aPath)),
    extensions: extensions,
  };
}
