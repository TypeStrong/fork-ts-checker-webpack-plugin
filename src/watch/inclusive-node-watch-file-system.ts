import { extname, relative, isAbsolute } from 'path';

import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import minimatch from 'minimatch';
import type { Compiler } from 'webpack';

import { clearFilesChange, updateFilesChange } from '../files-change';
import { getInfrastructureLogger } from '../infrastructure-logger';
import type { ForkTsCheckerWebpackPluginState } from '../plugin-state';
import { isInsideAnotherPath } from '../utils/path/is-inside-another-path';

import type { WatchFileSystem } from './watch-file-system';

const BUILTIN_IGNORED_DIRS = ['.git'];

function createIsIgnored(
  ignored: string | RegExp | (string | RegExp)[] | undefined,
  excluded: string[]
): (path: string) => boolean {
  const ignoredPatterns = ignored ? (Array.isArray(ignored) ? ignored : [ignored]) : [];
  const ignoredFunctions = ignoredPatterns.map((pattern) => {
    // ensure patterns are valid - see https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/issues/594
    if (typeof pattern === 'string') {
      return (path: string) => minimatch(path, pattern);
    } else if (pattern instanceof RegExp) {
      return (path: string) => pattern.test(path);
    } else {
      // fallback to no-ignore function
      return () => false;
    }
  });
  ignoredFunctions.push((path: string) =>
    excluded.some((excludedPath) => isInsideAnotherPath(excludedPath, path))
  );
  ignoredFunctions.push((path: string) =>
    BUILTIN_IGNORED_DIRS.some(
      (ignoredDir) => path.includes(`/${ignoredDir}/`) || path.includes(`\\${ignoredDir}\\`)
    )
  );

  return function isIgnored(path: string) {
    return ignoredFunctions.some((ignoredFunction) => ignoredFunction(path));
  };
}

class InclusiveNodeWatchFileSystem implements WatchFileSystem {
  get watcher() {
    return this.watchFileSystem.watcher || this.watchFileSystem.wfs?.watcher;
  }

  private readonly dirsWatchers: Map<string, FSWatcher | undefined>;
  private paused = true;
  private deletedFiles: Set<string>;

  constructor(
    private watchFileSystem: WatchFileSystem,
    private compiler: Compiler,
    private pluginState: ForkTsCheckerWebpackPluginState
  ) {
    this.dirsWatchers = new Map();
    this.deletedFiles = new Set();
  }

  watch: WatchFileSystem['watch'] = (
    files,
    dirs,
    missing,
    startTime,
    options,
    callback,
    callbackUndelayed
  ) => {
    const { debug } = getInfrastructureLogger(this.compiler);

    clearFilesChange(this.compiler);
    const isIgnored = createIsIgnored(
      options?.ignored,
      this.pluginState.lastDependencies?.excluded || []
    );

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
      if (typeof file !== 'string') {
        return;
      }

      if (!isIgnored(file)) {
        debug('Detected file change', file);
        this.deletedFiles.delete(file);
        updateFilesChange(this.compiler, { changedFiles: [file] });
      } else {
        debug("Detected file change but it's ignored", file);
      }
    });
    this.watcher?.on('remove', (file: string) => {
      if (typeof file !== 'string') {
        return;
      }

      if (this.deletedFiles.has(file)) {
        debug('Skipping duplicated remove event.');
        return;
      }

      if (!isIgnored(file)) {
        debug('Detected file remove', file);
        this.deletedFiles.add(file);
        updateFilesChange(this.compiler, { deletedFiles: [file] });
      } else {
        debug("Detected file remove but it's ignored", file);
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
          debug('Detected new file add but extension is not supported', file);
          return;
        }

        debug('Detected new file add', file);
        this.deletedFiles.delete(file);
        updateFilesChange(this.compiler, { changedFiles: [file] });

        this.watcher?._onChange(dirToWatch, stats?.mtimeMs || stats?.ctimeMs || 1, file, 'rename');
      });
      dirWatcher.on('unlink', (file) => {
        if (this.paused) {
          return;
        }

        const extension = extname(file);
        const supportedExtensions = this.pluginState.lastDependencies?.extensions || [];

        if (!supportedExtensions.includes(extension)) {
          debug('Detected new file remove but extension is not supported', file);
          return;
        }

        if (this.deletedFiles.has(file)) {
          debug('Skipping duplicated unlink event.');
          return;
        }

        debug('Detected new file remove', file);
        this.deletedFiles.add(file);
        updateFilesChange(this.compiler, { deletedFiles: [file] });

        this.watcher?._onRemove(dirToWatch, file, 'rename');
      });
      this.dirsWatchers.set(dirToWatch, dirWatcher);
    });

    this.paused = false;

    return {
      ...standardWatcher,
      close: () => {
        clearFilesChange(this.compiler);

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
  };
}

export { InclusiveNodeWatchFileSystem };
