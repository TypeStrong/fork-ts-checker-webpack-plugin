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
// outputs that `mode` says must not reach the disk, keyed by forward-slashed path
const outputs = new Map<string, string>();
// when each output was written: the up-to-date check compares inputs with the
// .tsbuildinfo mtime, so reporting "now" would make every input look older
const outputTimes = new Map<string, Date>();
const outputDirectories = new Set<string>();

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
function createFileSystemCallbacks(): Partial<FileSystemCallbacks> | undefined {
  if (!config.build || config.mode === 'write-references') {
    return undefined;
  }
  const { serverFS } = typescriptFs;
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
  const realDirectories = new Map<string, string>();
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

  return {
    writeFile(fileName, content) {
      if (isWrittenToDisk(fileName)) {
        writtenToDisk.add(fileName);
        return serverFS.useOS;
      }
      outputs.set(fileName, content);
      outputTimes.set(fileName, new Date());
      for (let dir = path.posix.dirname(fileName); !outputDirectories.has(dir); ) {
        outputDirectories.add(dir);
        const parent = path.posix.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return serverFS.noop;
    },
    readFile: (fileName) =>
      isHidden(fileName) ? undefined : outputs.get(toOutputPath(fileName)) ?? serverFS.useOS,
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
}

export function getApi(): API {
  if (!api) {
    api = new typescriptSync.API({
      cwd: config.context,
      fs: createFileSystemCallbacks() as FileSystemCallbacks | undefined,
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

/** The native compiler runs in its own process, which must not outlive the worker. */
export function closeApiOnExit() {
  process.on('exit', closeApi);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      closeApi();
      // the listener is gone, so this re-raises with the default behaviour
      process.kill(process.pid, signal);
    });
  }
}

export function closeApi() {
  outputs.clear();
  outputTimes.clear();
  outputDirectories.clear();
  if (api) {
    try {
      api.close();
    } catch (error) {
      // the compiler process may already be gone
    }
    api = undefined;
  }
}
