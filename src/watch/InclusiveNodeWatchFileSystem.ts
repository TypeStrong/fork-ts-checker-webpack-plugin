import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import chokidar, { FSWatcher } from 'chokidar';
import { extname } from 'path';
import { Watcher, WatchFileSystem, WatchFileSystemOptions } from './WatchFileSystem';

class InclusiveNodeWatchFileSystem implements WatchFileSystem {
  get watcher() {
    return this.watchFileSystem.watcher || this.watchFileSystem.wfs?.watcher;
  }

  readonly changedFiles: Set<string>;
  readonly removedFiles: Set<string>;

  constructor(
    private watchFileSystem: WatchFileSystem,
    private pluginState: ForkTsCheckerWebpackPluginState
  ) {
    this.changedFiles = new Set();
    this.removedFiles = new Set();
    this.dirsWatchers = new Map();
  }

  private paused = true;
  private fileWatcher: Watcher | undefined;
  private dirsWatchers: Map<string, FSWatcher | undefined>;

  watch(
    files: Iterable<string>,
    dirs: Iterable<string>,
    missing: Iterable<string>,
    startTime?: number,
    options?: Partial<WatchFileSystemOptions>,
    callback?: Function,
    callbackUndelayed?: Function
  ): Watcher {
    this.changedFiles.clear();
    this.removedFiles.clear();

    // cleanup old standard watchers
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }

    // use standard watch file system for files and missing
    this.fileWatcher = this.watchFileSystem.watch(
      files,
      [],
      missing,
      startTime,
      options,
      callback,
      callbackUndelayed
    );

    this.watcher?.on('change', (file: string) => {
      this.changedFiles.add(file);
      this.removedFiles.delete(file);
    });
    this.watcher?.on('remove', (file: string) => {
      this.removedFiles.add(file);
      this.changedFiles.delete(file);
    });

    // calculate what to change
    const prevDirs = Array.from(this.dirsWatchers.keys());
    const nextDirs = Array.from(dirs);
    const dirsToUnwatch = prevDirs.filter((prevDir) => !nextDirs.includes(prevDir));
    const dirsToWatch = nextDirs.filter((nextDir) => !prevDirs.includes(nextDir));

    // update dirs watcher
    dirsToUnwatch.forEach((dirToUnwatch) => {
      this.dirsWatchers.get(dirToUnwatch)?.close();
      this.dirsWatchers.delete(dirToUnwatch);
    });
    dirsToWatch.forEach((dirToWatch) => {
      const interval = typeof options?.poll === 'number' ? options.poll : undefined;

      const dirWatcher = chokidar.watch(dirToWatch, {
        ignoreInitial: true,
        ignorePermissionErrors: true,
        ignored: ['**/node_modules/**', '**/.git/**'],
        usePolling: options?.poll ? true : undefined,
        interval: interval,
        binaryInterval: interval,
        alwaysStat: true,
        atomic: true,
        awaitWriteFinish: true,
      });

      dirWatcher.on('add', (file, stats) => {
        if (this.paused) {
          return;
        }

        const extension = extname(file);
        const supportedExtensions = this.pluginState.lastDependencies?.extensions || [];

        if (!supportedExtensions.includes(extension)) {
          return;
        }

        this.changedFiles.add(file);
        this.removedFiles.delete(file);

        const mtime = stats?.mtimeMs || stats?.ctimeMs || 1;

        this.watcher?._onChange(dirToWatch, mtime, file, 'rename');
      });
      dirWatcher.on('unlink', (file) => {
        if (this.paused) {
          return;
        }

        const extension = extname(file);
        const supportedExtensions = this.pluginState.lastDependencies?.extensions || [];

        if (!supportedExtensions.includes(extension)) {
          return;
        }

        this.removedFiles.add(file);
        this.changedFiles.delete(file);

        this.watcher?._onRemove(dirToWatch, file, 'rename');
      });
      this.dirsWatchers.set(dirToWatch, dirWatcher);
    });

    this.paused = false;

    return {
      ...this.fileWatcher,
      close: () => {
        this.changedFiles.clear();
        this.removedFiles.clear();

        if (this.fileWatcher) {
          this.fileWatcher.close();
          this.fileWatcher = undefined;
        }
        this.dirsWatchers.forEach((dirWatcher) => {
          dirWatcher?.close();
        });
        this.dirsWatchers.clear();

        this.paused = true;
      },
      pause: () => {
        if (this.fileWatcher) {
          this.fileWatcher.pause();
        }
        this.paused = true;
      },
    };
  }
}

export { InclusiveNodeWatchFileSystem };
