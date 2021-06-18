import * as ts from 'typescript';
import { dirname, join } from 'path';
import { createPassiveFileSystem } from '../file-system/PassiveFileSystem';
import forwardSlash from '../../utils/path/forwardSlash';
import { createRealFileSystem } from '../file-system/RealFileSystem';
import { createMemFileSystem } from '../file-system/MemFileSystem';
import { FilesMatch } from '../../reporter';

interface ControlledTypeScriptSystem extends ts.System {
  // control watcher
  invokeFileCreated(path: string): void;
  invokeFileChanged(path: string): void;
  invokeFileDeleted(path: string): void;
  // control cache
  clearCache(): void;
  // mark these methods as defined - not optional
  getFileSize(path: string): number;
  watchFile(
    path: string,
    callback: ts.FileWatcherCallback,
    pollingInterval?: number,
    options?: ts.WatchOptions
  ): ts.FileWatcher;
  watchDirectory(
    path: string,
    callback: ts.DirectoryWatcherCallback,
    recursive?: boolean,
    options?: ts.WatchOptions
  ): ts.FileWatcher;
  getModifiedTime(path: string): Date | undefined;
  setModifiedTime(path: string, time: Date): void;
  deleteFile(path: string): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clearTimeout(timeoutId: any): void;
  // detect when all tasks scheduled by `setTimeout` finished
  waitForQueued(): Promise<void>;
  setArtifacts(artifacts: FilesMatch): void;
}

type FileSystemMode = 'readonly' | 'write-tsbuildinfo' | 'write-references';

function createControlledTypeScriptSystem(
  typescript: typeof ts,
  mode: FileSystemMode = 'readonly'
): ControlledTypeScriptSystem {
  let artifacts: FilesMatch = {
    files: [],
    dirs: [],
    extensions: [],
  };
  let isInitialRun = true;
  // watchers
  const fileWatcherCallbacksMap = new Map<string, ts.FileWatcherCallback[]>();
  const directoryWatcherCallbacksMap = new Map<string, ts.DirectoryWatcherCallback[]>();
  const recursiveDirectoryWatcherCallbacksMap = new Map<string, ts.DirectoryWatcherCallback[]>();
  const deletedFiles = new Map<string, boolean>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeoutCallbacks = new Set<any>();
  // always use case-sensitive as normalization to lower-case can be a problem for some
  // third-party libraries, like fsevents
  const caseSensitive = true;
  const realFileSystem = createRealFileSystem(caseSensitive);
  const memFileSystem = createMemFileSystem(realFileSystem);
  const passiveFileSystem = createPassiveFileSystem(memFileSystem, realFileSystem);

  // based on the ts.ignorePaths
  const ignoredPaths = ['/node_modules/.', '/.git', '/.#'];

  function createWatcher<TCallback>(
    watchersMap: Map<string, TCallback[]>,
    path: string,
    callback: TCallback
  ) {
    const normalizedPath = realFileSystem.normalizePath(path);

    const watchers = watchersMap.get(normalizedPath) || [];
    const nextWatchers = [...watchers, callback];
    watchersMap.set(normalizedPath, nextWatchers);

    return {
      close: () => {
        const watchers = watchersMap.get(normalizedPath) || [];
        const nextWatchers = watchers.filter((watcher) => watcher !== callback);

        if (nextWatchers.length > 0) {
          watchersMap.set(normalizedPath, nextWatchers);
        } else {
          watchersMap.delete(normalizedPath);
        }
      },
    };
  }

  function invokeFileWatchers(path: string, event: ts.FileWatcherEventKind) {
    const normalizedPath = realFileSystem.normalizePath(path);
    if (normalizedPath.endsWith('.js')) {
      // trigger relevant .d.ts file watcher - handles the case, when we have webpack watcher
      // that points to a symlinked package
      invokeFileWatchers(normalizedPath.slice(0, -3) + '.d.ts', event);
    }

    const fileWatcherCallbacks = fileWatcherCallbacksMap.get(normalizedPath);
    if (fileWatcherCallbacks) {
      // typescript expects normalized paths with posix forward slash
      fileWatcherCallbacks.forEach((fileWatcherCallback) =>
        fileWatcherCallback(forwardSlash(normalizedPath), event)
      );
    }
  }

  function invokeDirectoryWatchers(path: string) {
    const normalizedPath = realFileSystem.normalizePath(path);
    const directory = dirname(normalizedPath);

    if (ignoredPaths.some((ignoredPath) => forwardSlash(normalizedPath).includes(ignoredPath))) {
      return;
    }

    const directoryWatcherCallbacks = directoryWatcherCallbacksMap.get(directory);
    if (directoryWatcherCallbacks) {
      directoryWatcherCallbacks.forEach((directoryWatcherCallback) =>
        directoryWatcherCallback(forwardSlash(normalizedPath))
      );
    }

    recursiveDirectoryWatcherCallbacksMap.forEach(
      (recursiveDirectoryWatcherCallbacks, watchedDirectory) => {
        if (
          watchedDirectory === directory ||
          (directory.startsWith(watchedDirectory) &&
            forwardSlash(directory)[watchedDirectory.length] === '/')
        ) {
          recursiveDirectoryWatcherCallbacks.forEach((recursiveDirectoryWatcherCallback) =>
            recursiveDirectoryWatcherCallback(forwardSlash(normalizedPath))
          );
        }
      }
    );
  }

  function isArtifact(path: string) {
    return (
      (artifacts.dirs.some((dir) => path.includes(dir)) ||
        artifacts.files.some((file) => path === file)) &&
      artifacts.extensions.some((extension) => path.endsWith(extension))
    );
  }

  function getReadFileSystem(path: string) {
    if (
      !isInitialRun &&
      (mode === 'readonly' || mode === 'write-tsbuildinfo') &&
      isArtifact(path)
    ) {
      return memFileSystem;
    }

    return passiveFileSystem;
  }

  function getWriteFileSystem(path: string) {
    if (
      mode === 'write-references' ||
      (mode === 'write-tsbuildinfo' && path.endsWith('.tsbuildinfo'))
    ) {
      return realFileSystem;
    }

    return passiveFileSystem;
  }

  const controlledSystem: ControlledTypeScriptSystem = {
    ...typescript.sys,
    useCaseSensitiveFileNames: caseSensitive,
    fileExists(path: string): boolean {
      const stats = getReadFileSystem(path).readStats(path);

      return !!stats && stats.isFile();
    },
    readFile(path: string, encoding?: string): string | undefined {
      return getReadFileSystem(path).readFile(path, encoding);
    },
    getFileSize(path: string): number {
      const stats = getReadFileSystem(path).readStats(path);

      return stats ? stats.size : 0;
    },
    writeFile(path: string, data: string): void {
      getWriteFileSystem(path).writeFile(path, data);

      controlledSystem.invokeFileChanged(path);
    },
    deleteFile(path: string): void {
      getWriteFileSystem(path).deleteFile(path);

      controlledSystem.invokeFileDeleted(path);
    },
    directoryExists(path: string): boolean {
      return Boolean(getReadFileSystem(path).readStats(path)?.isDirectory());
    },
    createDirectory(path: string): void {
      getWriteFileSystem(path).createDir(path);

      invokeDirectoryWatchers(path);
    },
    getDirectories(path: string): string[] {
      const dirents = getReadFileSystem(path).readDir(path);

      return dirents
        .filter(
          (dirent) =>
            dirent.isDirectory() ||
            (dirent.isSymbolicLink() && controlledSystem.directoryExists(join(path, dirent.name)))
        )
        .map((dirent) => dirent.name);
    },
    getModifiedTime(path: string): Date | undefined {
      const stats = getReadFileSystem(path).readStats(path);

      if (stats) {
        return stats.mtime;
      }
    },
    setModifiedTime(path: string, date: Date): void {
      getWriteFileSystem(path).updateTimes(path, date, date);

      invokeDirectoryWatchers(path);
      invokeFileWatchers(path, typescript.FileWatcherEventKind.Changed);
    },
    watchFile(path: string, callback: ts.FileWatcherCallback): ts.FileWatcher {
      return createWatcher(fileWatcherCallbacksMap, path, callback);
    },
    watchDirectory(
      path: string,
      callback: ts.DirectoryWatcherCallback,
      recursive = false
    ): ts.FileWatcher {
      return createWatcher(
        recursive ? recursiveDirectoryWatcherCallbacksMap : directoryWatcherCallbacksMap,
        path,
        callback
      );
    },
    // use immediate instead of timeout to avoid waiting 250ms for batching files changes
    setTimeout: (callback, timeout, ...args) => {
      const timeoutId = setImmediate(() => {
        callback(...args);
        timeoutCallbacks.delete(timeoutId);
      });
      timeoutCallbacks.add(timeoutId);

      return timeoutId;
    },
    clearTimeout: (timeoutId) => {
      clearImmediate(timeoutId);
      timeoutCallbacks.delete(timeoutId);
    },
    async waitForQueued(): Promise<void> {
      while (timeoutCallbacks.size > 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      isInitialRun = false;
    },
    invokeFileCreated(path: string) {
      const normalizedPath = realFileSystem.normalizePath(path);

      invokeFileWatchers(path, typescript.FileWatcherEventKind.Created);
      invokeDirectoryWatchers(normalizedPath);

      deletedFiles.set(normalizedPath, false);
    },
    invokeFileChanged(path: string) {
      const normalizedPath = realFileSystem.normalizePath(path);

      if (deletedFiles.get(normalizedPath) || !fileWatcherCallbacksMap.has(normalizedPath)) {
        invokeFileWatchers(path, typescript.FileWatcherEventKind.Created);
        invokeDirectoryWatchers(normalizedPath);

        deletedFiles.set(normalizedPath, false);
      } else {
        invokeFileWatchers(path, typescript.FileWatcherEventKind.Changed);
      }
    },
    invokeFileDeleted(path: string) {
      const normalizedPath = realFileSystem.normalizePath(path);

      if (!deletedFiles.get(normalizedPath)) {
        invokeFileWatchers(path, typescript.FileWatcherEventKind.Deleted);
        invokeDirectoryWatchers(path);

        deletedFiles.set(normalizedPath, true);
      }
    },
    clearCache() {
      realFileSystem.clearCache();
      memFileSystem.clearCache();
      passiveFileSystem.clearCache();
    },
    setArtifacts(nextArtifacts: FilesMatch) {
      artifacts = nextArtifacts;
    },
  };

  return controlledSystem;
}

export { createControlledTypeScriptSystem, ControlledTypeScriptSystem };
