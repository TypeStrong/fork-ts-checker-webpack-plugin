import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import chokidar, { FSWatcher } from 'chokidar';
import { extname } from 'path';
import { Watcher, WatchFileSystem, WatchFileSystemOptions } from './WatchFileSystem';

const IGNORED_DIRS = ['node_modules', '.git', '.yarn', '.pnp'];

function isIgnored(path: string) {
  return IGNORED_DIRS.some((ignoredDir) => path.includes(`/${ignoredDir}/`));
}

class InclusiveNodeWatchFileSystem implements WatchFileSystem {
  get watcher() {
    return this.watchFileSystem.watcher || this.watchFileSystem.wfs?.watcher;
  }

  readonly changedFiles: Set<string>;
  readonly removedFiles: Set<string>;
  readonly dirsWatchers: Map<string, FSWatcher | undefined>;

  constructor(
    private watchFileSystem: WatchFileSystem,
    private pluginState: ForkTsCheckerWebpackPluginState
  ) {
    this.changedFiles = new Set();
    this.removedFiles = new Set();
    this.dirsWatchers = new Map();
  }

  private paused = true;

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

    // use standard watch file system for files and missing
    const standardWatcher = this.watchFileSystem.watch(
      files,
      dirs,
      missing,
      startTime,
      options,
      callback,
      callbackUndelayed
    );

    this.watcher?.on('change', (file: string) => {
      if (typeof file === 'string' && !isIgnored(file)) {
        this.changedFiles.add(file);
        this.removedFiles.delete(file);
      }
    });
    this.watcher?.on('remove', (file: string) => {
      if (typeof file === 'string' && !isIgnored(file)) {
        this.removedFiles.add(file);
        this.changedFiles.delete(file);
      }
    });

    // calculate what to change
    const prevDirs = Array.from(this.dirsWatchers.keys());
    const nextDirs = Array.from(this.pluginState.lastDependencies?.dirs || []);
    const dirsToUnwatch = prevDirs.filter((prevDir) => !nextDirs.includes(prevDir));
    const dirsToWatch = nextDirs.filter(
      (nextDir) => !prevDirs.includes(nextDir) && !isIgnored(nextDir)
    );

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
        ignored: (path: string) => isIgnored(path),
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
      ...standardWatcher,
      close: () => {
        this.changedFiles.clear();
        this.removedFiles.clear();

        if (standardWatcher) {
          standardWatcher.close();
        }
        this.dirsWatchers.forEach((dirWatcher) => {
          dirWatcher?.close();
        });
        this.dirsWatchers.clear();

        this.paused = true;
      },
      pause: () => {
        if (standardWatcher) {
          standardWatcher.pause();
        }
        this.paused = true;
      },
    };
  }
}

export { InclusiveNodeWatchFileSystem };
