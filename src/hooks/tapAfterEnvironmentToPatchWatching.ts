import webpack from 'webpack';
import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { realpathSync } from 'fs';

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

  constructor(private watchFileSystem: WatchFileSystem) {}

  watch(
    files: Iterable<string>,
    dirs: Iterable<string>,
    missing: Iterable<string>,
    startTime?: number,
    options?: Partial<WatchFileSystemOptions>,
    callback?: Function,
    callbackUndelayed?: Function
  ): Watcher {
    // use standard watch file system for files and missing
    const standardWatcher = this.watchFileSystem.watch(
      files,
      [],
      missing,
      startTime,
      options,
      callback,
      callbackUndelayed
    );

    let paused = false;

    // use custom watch for dirs
    const dirWatchers = new Map<string, FSWatcher>();

    for (const dir of dirs) {
      if (!dirWatchers.has(dir)) {
        const watcher = chokidar.watch(dir, {
          ignored: ['**/node_modules/**', '**/.git/**'],
          ignoreInitial: true,
          alwaysStat: true,
        });
        watcher.on('add', (file, stats) => {
          if (paused) {
            return;
          }
          const path = realpathSync.native(file);

          this.watcher?._onChange(path, stats?.mtimeMs || 0, path, 'rename');
        });
        watcher.on('unlink', (file) => {
          if (paused) {
            return;
          }

          this.watcher?._onRemove(file, file, 'rename');
        });
        dirWatchers.set(dir, watcher);
      }
    }

    const getFileTimeInfoEntries = () => {
      if ((standardWatcher as WatcherV4).getFileTimestamps) {
        return (standardWatcher as WatcherV4).getFileTimestamps();
      } else if ((standardWatcher as WatcherV5).getFileTimeInfoEntries) {
        return (standardWatcher as WatcherV5).getFileTimeInfoEntries();
      }
      return new Map<string, number>();
    };

    const getContextTimeInfoEntries = () => {
      if ((standardWatcher as WatcherV4).getContextTimestamps) {
        return (standardWatcher as WatcherV4).getContextTimestamps();
      } else if ((standardWatcher as WatcherV5).getContextTimeInfoEntries) {
        return (standardWatcher as WatcherV5).getContextTimeInfoEntries();
      }
      return new Map<string, number>();
    };

    return {
      close() {
        standardWatcher.close();
        dirWatchers.forEach((dirWatcher) => dirWatcher.close());
        paused = true;
      },
      pause() {
        standardWatcher.pause();
        paused = true;
      },
      getFileTimestamps: getFileTimeInfoEntries,
      getContextTimestamps: getContextTimeInfoEntries,
      getFileTimeInfoEntries: getFileTimeInfoEntries,
      getContextTimeInfoEntries: getContextTimeInfoEntries,
    };
  }
}

function tapAfterEnvironmentToPatchWatching(compiler: webpack.Compiler) {
  compiler.hooks.afterEnvironment.tap('ForkTsCheckerWebpackPlugin', () => {
    const watchFileSystem = (compiler as CompilerWithWatchFileSystem).watchFileSystem;
    if (watchFileSystem) {
      // wrap original watch file system
      (compiler as CompilerWithWatchFileSystem).watchFileSystem = new InclusiveNodeWatchFileSystem(
        watchFileSystem
      );
    }
  });
}

export { tapAfterEnvironmentToPatchWatching };
