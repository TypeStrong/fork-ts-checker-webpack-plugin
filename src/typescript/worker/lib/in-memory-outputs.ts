import * as fs from 'fs';
import * as path from 'path';

import type { FileSystemCallbacks } from 'typescript/fs';

import { forwardSlash } from '../../../utils/path/forward-slash';

import { typescriptFs } from './typescript';

/**
 * File system callbacks that keep everything the compiler writes in memory, for
 * the `build` option in the `in-memory` mode: only there TypeScript decides what
 * to write. The callbacks are round trips from the native compiler, so what they
 * don't hold is left to the compiler's own file system.
 */
export function createInMemoryOutputs(): {
  callbacks: FileSystemCallbacks;
  invalidateRealDirectories: () => void;
} {
  const { serverFS } = typescriptFs;
  // The compiler always gives the callbacks forward-slashed paths, on
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
  // other outputs. A .tsbuildinfo on disk comes from a run that wrote its outputs,
  // or from `tsc --build`, and could mark projects as built while their .d.ts
  // files are missing from memory - hide any this worker didn't write.
  const isHidden = (fileName: string) =>
    fileName.endsWith('.tsbuildinfo') && !outputs.has(fileName);

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
    // never delete anything on disk, like the user's real build output
    removeFile: (fileName) => {
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
