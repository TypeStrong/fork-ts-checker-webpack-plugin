import * as ts from 'typescript';
import { dirname } from 'path';
import { createPassiveFileSystem } from './PassiveFileSystem';
import normalizeSlash from '../../utils/path/normalizeSlash';

interface ControlledTypeScriptSystem extends ts.System {
  // control watcher
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
}

function createControlledTypeScriptSystem(): ControlledTypeScriptSystem {
  // watchers
  const fileWatchersMap = new Map<string, ts.FileWatcherCallback[]>();
  const directoryWatchersMap = new Map<string, ts.DirectoryWatcherCallback[]>();
  const recursiveDirectoryWatchersMap = new Map<string, ts.DirectoryWatcherCallback[]>();
  const deletedFiles = new Map<string, boolean>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeoutCallbacks = new Set<any>();
  const caseSensitive = ts.sys.useCaseSensitiveFileNames;
  const fileSystem = createPassiveFileSystem(caseSensitive);

  function createWatcher<TCallback>(
    watchersMap: Map<string, TCallback[]>,
    path: string,
    callback: TCallback
  ) {
    const normalizedPath = fileSystem.normalizePath(path);

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

  const invokeFileWatchers = (path: string, event: ts.FileWatcherEventKind) => {
    const normalizedPath = fileSystem.normalizePath(path);

    const fileWatchers = fileWatchersMap.get(normalizedPath);
    if (fileWatchers) {
      // typescript expects normalized paths with posix forward slash
      fileWatchers.forEach((fileWatcher) => fileWatcher(normalizeSlash(normalizedPath), event));
    }
  };

  const invokeDirectoryWatchers = (path: string) => {
    const normalizedPath = fileSystem.normalizePath(path);
    let directory = dirname(normalizedPath);

    const directoryWatchers = directoryWatchersMap.get(directory);
    if (directoryWatchers) {
      directoryWatchers.forEach((directoryWatcher) =>
        directoryWatcher(normalizeSlash(normalizedPath))
      );
    }

    while (directory !== dirname(directory)) {
      const recursiveDirectoryWatchers = recursiveDirectoryWatchersMap.get(directory);
      if (recursiveDirectoryWatchers) {
        recursiveDirectoryWatchers.forEach((recursiveDirectoryWatcher) =>
          recursiveDirectoryWatcher(normalizeSlash(normalizedPath))
        );
      }

      directory = dirname(directory);
    }
  };

  const controlledSystem: ControlledTypeScriptSystem = {
    ...ts.sys,
    useCaseSensitiveFileNames: caseSensitive,
    fileExists(path: string): boolean {
      const stats = fileSystem.readStats(path);

      return !!stats && stats.isFile();
    },
    readFile(path: string, encoding?: string): string | undefined {
      return fileSystem.readFile(path, encoding);
    },
    getFileSize(path: string): number {
      const stats = fileSystem.readStats(path);

      return stats ? stats.size : 0;
    },
    writeFile(path: string, data: string): void {
      fileSystem.writeFile(path, data);

      controlledSystem.invokeFileChanged(path);
    },
    deleteFile(path: string): void {
      fileSystem.deleteFile(path);

      controlledSystem.invokeFileDeleted(path);
    },
    directoryExists(path: string): boolean {
      const stats = fileSystem.readStats(path);

      return !!stats && stats.isDirectory();
    },
    createDirectory(path: string): void {
      fileSystem.createDir(path);

      invokeDirectoryWatchers(path);
    },
    getDirectories(path: string): string[] {
      const dirents = fileSystem.readDir(path);

      return dirents.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
    },
    getModifiedTime(path: string): Date | undefined {
      const stats = fileSystem.readStats(path);

      if (stats) {
        return stats.mtime;
      }
    },
    setModifiedTime(path: string, date: Date): void {
      fileSystem.updateTimes(path, date, date);

      invokeDirectoryWatchers(path);
      invokeFileWatchers(path, ts.FileWatcherEventKind.Changed);
    },
    watchFile(path: string, callback: ts.FileWatcherCallback): ts.FileWatcher {
      return createWatcher(fileWatchersMap, path, callback);
    },
    watchDirectory(
      path: string,
      callback: ts.DirectoryWatcherCallback,
      recursive = false
    ): ts.FileWatcher {
      return createWatcher(
        recursive ? recursiveDirectoryWatchersMap : directoryWatchersMap,
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
    },
    invokeFileChanged(path: string) {
      const normalizedPath = fileSystem.normalizePath(path);

      invokeDirectoryWatchers(normalizedPath);

      if (deletedFiles.get(normalizedPath)) {
        invokeFileWatchers(path, ts.FileWatcherEventKind.Created);
        deletedFiles.set(normalizedPath, false);
      } else {
        invokeFileWatchers(path, ts.FileWatcherEventKind.Changed);
      }
    },
    invokeFileDeleted(path: string) {
      const normalizedPath = fileSystem.normalizePath(path);

      if (!deletedFiles.get(normalizedPath)) {
        invokeDirectoryWatchers(path);
        invokeFileWatchers(path, ts.FileWatcherEventKind.Deleted);

        deletedFiles.set(normalizedPath, true);
      }
    },
    clearCache() {
      fileSystem.clearCache();
    },
  };

  return controlledSystem;
}

export { createControlledTypeScriptSystem, ControlledTypeScriptSystem };
