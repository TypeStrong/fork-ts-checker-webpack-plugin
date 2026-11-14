import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';

import type { ParsedCommandLine } from 'typescript/sync';

import type { FilesMatch } from '../../../files-match';

import { getApi } from './api';
import { getParsedConfig, parseConfig } from './config';
import { config } from './worker-config';

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.tsbuildinfo'];

interface ProjectGraph {
  dependencies: FilesMatch;
  configFiles: string[];
}

// both come from one walk over the project references, so they share a cache
let projectGraph: ProjectGraph | undefined;

function getProjectGraph(): ProjectGraph {
  if (!projectGraph) {
    projectGraph = createProjectGraph();
  }

  return projectGraph;
}

export function getDependencies(): FilesMatch {
  return getProjectGraph().dependencies;
}

/**
 * The root config file, the config file of every referenced project, and every
 * local config file they extend.
 */
export function getConfigFiles(): string[] {
  return getProjectGraph().configFiles;
}

export function invalidateDependencies() {
  projectGraph = undefined;
}

/** A project reference's `path` can be either a tsconfig file or its directory. */
export function resolveProjectReferencePath(referencePath: string): string {
  // a missing reference is reported by the compiler
  return isDirectory(referencePath) ? path.join(referencePath, 'tsconfig.json') : referencePath;
}

/**
 * Resolves an `include`/`exclude` entry. The parsed config keeps the
 * `${configDir}` template as is. TypeScript replaces it with the directory the
 * config is parsed against - the `context` option for the root config.
 */
function resolveConfigPattern(pattern: string, configFileContext: string) {
  return path.resolve(configFileContext, pattern.split('${configDir}').join(configFileContext));
}

function isDirectory(directory: string) {
  try {
    return fs.statSync(directory).isDirectory();
  } catch (error) {
    return false;
  }
}

function isFile(file: string) {
  try {
    return fs.statSync(file).isFile();
  } catch (error) {
    return false;
  }
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
    const resolvedPattern = resolveConfigPattern(pattern, configFileContext);
    const segments = resolvedPattern.split(/[\\/]/);
    const firstWildcard = segments.findIndex((segment) => /[*?]/.test(segment));
    const staticPart = (firstWildcard === -1 ? segments : segments.slice(0, firstWildcard)).join(
      '/'
    );
    // `resolvedPattern` is absolute - resolve against its root to keep the drive on Windows
    const directory = path.resolve(path.parse(resolvedPattern).root, staticPart);

    // a pattern without a wildcard can point to a file
    return firstWildcard === -1 && path.extname(directory) && !isDirectory(directory)
      ? path.dirname(directory)
      : directory;
  });
}

/** Mirrors how TypeScript resolves a relative or absolute `extends` path. */
function resolveExtendsPath(extendsPath: string, baseDirectory: string): string {
  const resolved = path.resolve(baseDirectory, extendsPath);

  // a directory with the same name doesn't count - TypeScript looks for a file
  return isFile(resolved) || resolved.endsWith('.json') ? resolved : `${resolved}.json`;
}

/**
 * Resolves an `extends` that names a package. Installed packages live in
 * node_modules, which isn't watched, but a workspace package is a symlink to a
 * directory that people edit - only those are returned, by their real path.
 *
 * This approximates TypeScript's own lookup. A specifier it gets wrong is left
 * untracked, which only costs a restart after that config changes.
 */
function resolveWorkspaceExtendsPath(
  extendsPath: string,
  baseDirectory: string
): string | undefined {
  const { resolve } = createRequire(path.join(baseDirectory, 'tsconfig.json'));
  const candidates = [extendsPath, `${extendsPath}.json`, `${extendsPath}/tsconfig.json`];

  for (const candidate of candidates) {
    let resolved: string;
    try {
      resolved = fs.realpathSync(resolve(candidate));
    } catch (error) {
      continue;
    }
    if (!resolved.endsWith('.json')) {
      // the package's code entry point, not a config file
      continue;
    }
    return resolved.split(path.sep).includes('node_modules') ? undefined : resolved;
  }

  return undefined;
}

/**
 * The chain of config files that `configFilePath` extends, without the file itself.
 * `baseDirectory` is the directory the config was parsed against - the `context`
 * option for the root config, which TypeScript also resolves `extends` against.
 */
function getExtendedConfigFiles(
  raw: unknown,
  configFilePath: string,
  baseDirectory: string,
  visited = new Set<string>([configFilePath])
): string[] {
  const extendsValue = (raw as { extends?: unknown } | undefined)?.extends;
  const extendsList = Array.isArray(extendsValue) ? extendsValue : [extendsValue];
  const extendedConfigFiles: string[] = [];

  for (const extendsPath of extendsList) {
    if (typeof extendsPath !== 'string') {
      continue;
    }
    const extendedConfigFile =
      extendsPath.startsWith('.') || path.isAbsolute(extendsPath)
        ? resolveExtendsPath(extendsPath, baseDirectory)
        : resolveWorkspaceExtendsPath(extendsPath, baseDirectory);
    if (!extendedConfigFile || visited.has(extendedConfigFile)) {
      continue;
    }
    visited.add(extendedConfigFile);
    extendedConfigFiles.push(extendedConfigFile);

    // follow the chain - a missing or invalid file is reported by the compiler
    const { config: extendedConfig } = getApi().readConfigFile(extendedConfigFile);
    extendedConfigFiles.push(
      ...getExtendedConfigFiles(
        extendedConfig,
        extendedConfigFile,
        path.dirname(extendedConfigFile),
        visited
      )
    );
  }

  return extendedConfigFiles;
}

function createProjectGraph(): ProjectGraph {
  const files = new Set<string>();
  const dirs = new Set<string>();
  const configFiles = new Set<string>();
  // a project can be referenced many times, or in a circle - parse each one once
  const visited = new Set<string>();

  const visit = (
    parsedConfig: ParsedCommandLine,
    configFilePath: string,
    configFileContext: string
  ) => {
    configFiles.add(configFilePath);
    getExtendedConfigFiles(parsedConfig.raw, configFilePath, configFileContext).forEach((file) =>
      configFiles.add(file)
    );
    parsedConfig.fileNames.forEach((file) => files.add(file));
    getIncludeDirectories(parsedConfig, configFileContext).forEach((dir) => dirs.add(dir));

    for (const projectReference of parsedConfig.projectReferences || []) {
      const childConfigFilePath = resolveProjectReferencePath(projectReference.path);
      const childConfigKey = path.normalize(childConfigFilePath);
      if (visited.has(childConfigKey)) {
        continue;
      }
      visited.add(childConfigKey);

      const childConfigContext = path.dirname(childConfigFilePath);
      visit(
        parseConfig(childConfigFilePath, childConfigContext),
        childConfigFilePath,
        childConfigContext
      );
    }
  };

  const parsedConfig = getParsedConfig();
  visited.add(path.normalize(config.configFile));
  visit(parsedConfig, config.configFile, config.context);
  configFiles.forEach((file) => files.add(file));

  const rawExclude = (parsedConfig.raw as { exclude?: unknown } | undefined)?.exclude;
  const excluded = (Array.isArray(rawExclude) ? rawExclude : [])
    .filter((pattern): pattern is string => typeof pattern === 'string')
    .map((pattern) => resolveConfigPattern(pattern, config.context));

  return {
    dependencies: {
      files: Array.from(files, (file) => path.normalize(file)),
      dirs: Array.from(dirs, (dir) => path.normalize(dir)),
      excluded: Array.from(new Set(excluded), (aPath) => path.normalize(aPath)),
      extensions: EXTENSIONS,
    },
    configFiles: Array.from(configFiles, (file) => path.normalize(file)),
  };
}
