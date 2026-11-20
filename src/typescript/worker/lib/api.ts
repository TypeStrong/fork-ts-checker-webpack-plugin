import * as fs from 'fs';
import * as path from 'path';

import type { FileSystemCallbacks } from 'typescript/fs';
import type { API, BuildOrchestrator, BuildOrchestratorOptions } from 'typescript/sync';

import { forwardSlash } from '../../../utils/path/forward-slash';

import { typescriptFs, typescriptSync } from './typescript';
import { config } from './worker-config';

// `API#createBuildOrchestrator` exists at runtime (it backs `tsc --build`),
// but isn't declared in the 7.1 typings yet.
type CreateBuildOrchestrator = (
  rootNames: readonly string[],
  options?: BuildOrchestratorOptions
) => BuildOrchestrator;

let api: API | undefined;
let invalidateRealDirectoriesOfApi: (() => void) | undefined;
let interceptsBuildOutputs = false;

/**
 * Makes the API keep build-mode outputs in memory according to `mode`. Only the
 * worker that builds needs it: the callbacks are round trips from the native
 * compiler, which a worker that only parses tsconfig files would pay for nothing.
 * Call it before the first `getApi()`.
 */
export function interceptBuildOutputs() {
  interceptsBuildOutputs = true;
}

/** Forgets the resolved symlinks, in case packages were relinked between builds. */
export function invalidateRealDirectories() {
  invalidateRealDirectoriesOfApi?.();
}

function isWrittenToDisk(fileName: string): boolean {
  switch (config.mode) {
    case 'write-references':
      return true;
    case 'write-dts':
      return fileName.endsWith('.tsbuildinfo') || /\.d\.[cm]?ts(\.map)?$/.test(fileName);
    case 'write-tsbuildinfo':
      return fileName.endsWith('.tsbuildinfo');
    default:
      return false;
  }
}

/**
 * Only `build` mode lets TypeScript decide what to write, so only it needs the
 * write interception. These callbacks are round trips from the native compiler,
 * so everything else is left to the compiler's own file system.
 */
function createFileSystemCallbacks():
  { callbacks: FileSystemCallbacks; invalidateRealDirectories: () => void } | undefined {
  if (!config.build || config.mode === 'write-references') {
    return undefined;
  }
  const { serverFS } = typescriptFs;
  // An in-memory file system for the build outputs that `mode` says must not reach
  // the disk. The compiler always gives the callbacks forward-slashed paths, on
  // Windows too (`C:/project/lib/index.d.ts`), so paths are handled with `path.posix`.
  // file content, by path
  const outputs = new Map<string, string>();
  // file mtime, by path: the up-to-date check compares inputs with the .tsbuildinfo
  // mtime, so reporting "now" would make every input look older
  const outputTimes = new Map<string, Date>();
  // the directories that contain the files
  const outputDirectories = new Set<string>();
  // A cache of resolved symlinks (symlinked directory -> real directory), cleared
  // before each build in case of relinks.
  const realDirectories = new Map<string, string>();
  // The up-to-date check only compares inputs with .tsbuildinfo, never with the
  // other outputs. Some outputs only ever lived in an earlier worker's memory (or
  // a run in another mode), so a .tsbuildinfo left on disk could mark projects as
  // built while their .d.ts files are missing - hide any this worker didn't write.
  const writtenToDisk = new Set<string>();
  const isHidden = (fileName: string) =>
    fileName.endsWith('.tsbuildinfo') && !outputs.has(fileName) && !writtenToDisk.has(fileName);

  // Outputs are keyed by their real path, but the compiler can also look them up
  // through a symlink - typically a workspace package in node_modules whose
  // `types` point at another project's in-memory .d.ts files.
  const toOutputPath = (fileName: string): string => {
    if (outputs.has(fileName) || outputDirectories.has(fileName)) {
      return fileName;
    }
    if (outputs.size === 0 || !fileName.includes('/node_modules/')) {
      return fileName;
    }
    let directory = path.posix.dirname(fileName);
    const rest = [path.posix.basename(fileName)];
    while (!realDirectories.has(directory) && !fs.existsSync(directory)) {
      const parent = path.posix.dirname(directory);
      if (parent === directory) {
        return fileName;
      }
      rest.unshift(path.posix.basename(directory));
      directory = parent;
    }
    let realDirectory = realDirectories.get(directory);
    if (realDirectory === undefined) {
      realDirectory = forwardSlash(fs.realpathSync(directory));
      realDirectories.set(directory, realDirectory);
    }
    return path.posix.join(realDirectory, ...rest);
  };

  // The API throws unless every callback is a function or a `serverFS` sentinel.
  const callbacks: FileSystemCallbacks = {
    writeFile(fileName, content) {
      if (isWrittenToDisk(fileName)) {
        writtenToDisk.add(fileName);
        return serverFS.useOS;
      }
      outputs.set(fileName, content);
      outputTimes.set(fileName, new Date());
      for (let dir = path.posix.dirname(fileName); !outputDirectories.has(dir);) {
        outputDirectories.add(dir);
        const parent = path.posix.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return serverFS.noop;
    },
    readFile: (fileName) =>
      isHidden(fileName) ? undefined : (outputs.get(toOutputPath(fileName)) ?? serverFS.useOS),
    fileExists: (fileName) =>
      isHidden(fileName) ? false : outputs.has(toOutputPath(fileName)) || serverFS.useOS,
    directoryExists: (directoryName) =>
      outputDirectories.has(toOutputPath(directoryName)) || serverFS.useOS,
    stat: (fileName) => {
      if (isHidden(fileName)) {
        return undefined;
      }
      const outputPath = toOutputPath(fileName);
      const content = outputs.get(outputPath);
      return content === undefined
        ? serverFS.useOS
        : {
            mode: 0o100644,
            size: Buffer.byteLength(content),
            mtime: outputTimes.get(outputPath) ?? new Date(),
          };
    },
    // never delete anything this mode doesn't write, like the user's real build output
    removeFile: (fileName) => {
      if (isWrittenToDisk(fileName)) {
        writtenToDisk.delete(fileName);
        return serverFS.useOS;
      }
      outputs.delete(fileName);
      outputTimes.delete(fileName);
      return serverFS.noop;
    },
    getAccessibleEntries: serverFS.useOS,
    realpath: (fileName) => {
      const outputPath = toOutputPath(fileName);
      return outputs.has(outputPath) || outputDirectories.has(outputPath)
        ? outputPath
        : serverFS.useOS;
    },
  };

  return { callbacks, invalidateRealDirectories: () => realDirectories.clear() };
}

export function getApi(): API {
  if (!api) {
    // the in-memory outputs live in the callbacks' closure, so they go with the API
    const fileSystem = interceptsBuildOutputs ? createFileSystemCallbacks() : undefined;
    invalidateRealDirectoriesOfApi = fileSystem?.invalidateRealDirectories;
    api = new typescriptSync.API({
      cwd: config.context,
      fs: fileSystem?.callbacks,
      collectTiming: config.profile,
    });
  }

  return api;
}

export function createBuildOrchestrator(
  rootNames: readonly string[],
  options: BuildOrchestratorOptions
): BuildOrchestrator {
  const create = (getApi() as unknown as { createBuildOrchestrator?: CreateBuildOrchestrator })
    .createBuildOrchestrator;
  if (typeof create !== 'function') {
    throw new Error(
      'The installed TypeScript version does not support the `build` option (missing API#createBuildOrchestrator).'
    );
  }

  return create.call(api, rootNames, options);
}

export function closeApi() {
  invalidateRealDirectoriesOfApi = undefined;
  if (api) {
    try {
      api.close();
    } catch (error) {
      // the compiler process may already be gone
    }
    api = undefined;
  }
}
