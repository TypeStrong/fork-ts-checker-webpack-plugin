import * as fs from 'fs';
import * as path from 'path';

import type { ParsedCommandLine } from 'typescript/sync';

import type { FilesMatch } from '../../../files-match';

import { getParsedConfig, parseConfig } from './config';
import { config } from './worker-config';

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.tsbuildinfo'];

let dependencies: FilesMatch | undefined;

export function getDependencies(force = false): FilesMatch {
  if (!dependencies || force) {
    const parsedConfig = getParsedConfig();

    dependencies = getDependenciesWorker(parsedConfig, config.configFile, config.context);
  }

  return dependencies;
}

export function invalidateDependencies() {
  dependencies = undefined;
}

/** A project reference's `path` can be either a tsconfig file or its directory. */
export function resolveProjectReferencePath(referencePath: string): string {
  try {
    if (fs.statSync(referencePath).isDirectory()) {
      return path.join(referencePath, 'tsconfig.json');
    }
  } catch (error) {
    // missing reference - the compiler reports it
  }
  return referencePath;
}

/**
 * The native API doesn't expose `wildcardDirectories`, so derive the directories
 * to watch from the static prefix of each `include` pattern.
 */
function getIncludeDirectories(parsedConfig: ParsedCommandLine, configFileContext: string) {
  const raw = (parsedConfig.raw || {}) as { include?: unknown; files?: unknown };
  const include = Array.isArray(raw.include)
    ? raw.include.filter((pattern): pattern is string => typeof pattern === 'string')
    : Array.isArray(raw.files)
    ? []
    : ['**/*'];

  return include.map((pattern) => {
    const segments = pattern.split(/[\\/]/);
    const firstWildcard = segments.findIndex((segment) => /[*?]/.test(segment));
    const staticPart = (firstWildcard === -1 ? segments : segments.slice(0, firstWildcard)).join(
      '/'
    );
    const directory = path.resolve(configFileContext, staticPart);

    // a pattern without a wildcard can point to a file
    return firstWildcard === -1 && path.extname(directory) ? path.dirname(directory) : directory;
  });
}

function getExtendedConfigFiles(parsedConfig: ParsedCommandLine, configFileContext: string) {
  const raw = (parsedConfig.raw || {}) as { extends?: unknown };
  const extendsList = Array.isArray(raw.extends) ? raw.extends : [raw.extends];

  // package-based `extends` live in node_modules, which we don't watch
  return extendsList
    .filter((extendsPath): extendsPath is string => typeof extendsPath === 'string')
    .filter((extendsPath) => extendsPath.startsWith('.') || path.isAbsolute(extendsPath))
    .map((extendsPath) => path.resolve(configFileContext, extendsPath));
}

function getDependenciesWorker(
  parsedConfig: ParsedCommandLine,
  configFilePath: string,
  configFileContext: string,
  processedConfigFiles: string[] = []
): FilesMatch {
  const files = new Set<string>(parsedConfig.fileNames);
  files.add(configFilePath);
  getExtendedConfigFiles(parsedConfig, configFileContext).forEach((file) => files.add(file));

  const dirs = new Set(getIncludeDirectories(parsedConfig, configFileContext));
  const rawExclude = (parsedConfig.raw as { exclude?: unknown } | undefined)?.exclude;
  const excluded = new Set<string>(
    (Array.isArray(rawExclude) ? rawExclude : []).map((filePath: string) =>
      path.resolve(configFileContext, filePath)
    )
  );

  for (const projectReference of parsedConfig.projectReferences || []) {
    const childConfigFilePath = resolveProjectReferencePath(projectReference.path);
    const childConfigContext = path.dirname(childConfigFilePath);
    if (processedConfigFiles.includes(childConfigFilePath)) {
      // handle circular dependencies
      continue;
    }
    const childParsedConfig = parseConfig(childConfigFilePath, childConfigContext);
    const childDependencies = getDependenciesWorker(
      childParsedConfig,
      childConfigFilePath,
      childConfigContext,
      [...processedConfigFiles, childConfigFilePath]
    );
    childDependencies.files.forEach((file) => {
      files.add(file);
    });
    childDependencies.dirs.forEach((dir) => {
      dirs.add(dir);
    });
  }

  return {
    files: Array.from(files).map((file) => path.normalize(file)),
    dirs: Array.from(dirs).map((dir) => path.normalize(dir)),
    excluded: Array.from(excluded).map((aPath) => path.normalize(aPath)),
    extensions: EXTENSIONS,
  };
}
