import webpack from 'webpack';
import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { extname } from 'path';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';

// webpack 4 interface
interface WatcherV4 {
  close(): void;
  pause(): void;
  getFileTimestamps(): Map<string, number>;
  getContextTimestamps(): Map<string, number>;
}

// webpack 5 interface
interface WatcherV5 {
  close(): void;
  pause(): void;
  getFileTimeInfoEntries(): Map<string, number>;
  getContextTimeInfoEntries(): Map<string, number>;
}

// watchpack v1 and v2 internal interface
interface Watchpack extends EventEmitter {
  _onChange(item: string, mtime: number, file: string, type?: string): void;
  _onRemove(item: string, file: string, type?: string): void;
}

type Watcher = WatcherV4 | WatcherV5;
type CompatibleWatcher = WatcherV4 & WatcherV5;

interface WatchFileSystemOptions {
  aggregateTimeout: number;
  poll: boolean;
  followSymlinks: boolean;
  ignored: string | RegExp | (string | RegExp)[];
}

interface WatchFileSystem {
  watcher: Watchpack;
  wfs?: {
    watcher: Watchpack;
  };
  watch(
    files: Iterable<string>,
    dirs: Iterable<string>,
    missing: Iterable<string>,
    startTime?: number,
    options?: Partial<WatchFileSystemOptions>,
    callback?: Function,
    callbackUndelayed?: Function
  ): Watcher;
}

interface CompilerWithWatchFileSystem extends webpack.Compiler {
  watchFileSystem?: WatchFileSystem;
}

class InclusiveNodeWatchFileSystem implements WatchFileSystem {
  get watcher() {
    return this.watchFileSystem.watcher || this.watchFileSystem.wfs?.watcher;
  }

  constructor(
    private watchFileSystem: WatchFileSystem,
    private pluginState: ForkTsCheckerWebpackPluginState
  ) {}

  private paused = true;
  private fileWatcher: Watcher | undefined;
  private dirsWatcher: FSWatcher | undefined;
  private dirsWatched: string[] = [];

  watch(
    files: Iterable<string>,
    dirs: Iterable<string>,
    missing: Iterable<string>,
    startTime?: number,
    options?: Partial<WatchFileSystemOptions>,
    callback?: Function,
    callbackUndelayed?: Function
  ): Watcher {
    if (!this.dirsWatcher) {
      const interval = typeof options?.poll === 'number' ? options.poll : undefined;

      this.dirsWatcher = chokidar.watch([], {
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

      this.dirsWatcher.on('add', (file, stats) => {
        if (this.paused) {
          return;
        }

        const extension = extname(file);
        const supportedExtensions = this.pluginState.lastDependencies?.extensions || [];

        if (!supportedExtensions.includes(extension)) {
          return;
        }

        const mtime = stats?.mtimeMs || stats?.ctimeMs || 1;

        this.watcher?._onChange(file, mtime, file, 'rename');
      });
      this.dirsWatcher.on('unlink', (file) => {
        if (this.paused) {
          return;
        }

        const extension = extname(file);
        const supportedExtensions = this.pluginState.lastDependencies?.extensions || [];

        if (!supportedExtensions.includes(extension)) {
          return;
        }

        this.watcher?._onRemove(file, file, 'rename');
      });
    }

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

    // calculate what to change
    const prevDirs = this.dirsWatched;
    const nextDirs = Array.from(dirs);
    const dirsToUnwatch = prevDirs.filter((prevDir) => !nextDirs.includes(prevDir));
    const dirsToWatch = nextDirs.filter((nextDir) => !prevDirs.includes(nextDir));

    // update dirs watcher
    if (dirsToUnwatch.length) {
      this.dirsWatcher.unwatch(dirsToUnwatch);
    }
    if (dirsToWatch.length) {
      this.dirsWatcher.add(dirsToWatch);
    }

    this.paused = false;
    this.dirsWatched = nextDirs;

    return {
      ...this.fileWatcher,
      close: () => {
        if (this.fileWatcher) {
          this.fileWatcher.close();
          this.fileWatcher = undefined;
        }
        if (this.dirsWatcher) {
          this.dirsWatcher.close();
          this.dirsWatcher = undefined;
        }

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

function tapAfterEnvironmentToPatchWatching(
  compiler: webpack.Compiler,
  state: ForkTsCheckerWebpackPluginState
) {
  compiler.hooks.afterEnvironment.tap('ForkTsCheckerWebpackPlugin', () => {
    const watchFileSystem = (compiler as CompilerWithWatchFileSystem).watchFileSystem;
    if (watchFileSystem) {
      // wrap original watch file system
      (compiler as CompilerWithWatchFileSystem).watchFileSystem = new InclusiveNodeWatchFileSystem(
        watchFileSystem,
        state
      );
    }
  });
}

export { tapAfterEnvironmentToPatchWatching };
