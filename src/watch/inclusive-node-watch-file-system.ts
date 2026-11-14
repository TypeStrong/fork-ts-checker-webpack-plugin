import type { FSWatcher, Stats } from 'fs';
import { statSync, watch } from 'fs';
import { extname, join } from 'path';

import type { Compiler } from 'webpack';

import { clearFilesChange, updateFilesChange } from '../files-change';
import { getInfrastructureLogger } from '../infrastructure-logger';
import type { ForkTsCheckerWebpackPluginState } from '../plugin-state';
import { isInsideAnotherPath } from '../utils/path/is-inside-another-path';
import { matchGlob } from '../utils/path/match-glob';

import type { WatchFileSystem } from './watch-file-system';

const BUILTIN_IGNORED_DIRS = ['.git'];
// how long a new file has to stay untouched before it's reported
const SETTLE_DELAY = 100;

function createIsIgnored(
  ignored: string | RegExp | (string | RegExp)[] | undefined,
  excluded: string[]
): (path: string) => boolean {
  const ignoredPatterns = ignored ? (Array.isArray(ignored) ? ignored : [ignored]) : [];
  const ignoredFunctions = ignoredPatterns.map((pattern) => {
    // ensure patterns are valid - see https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/issues/594
    if (typeof pattern === 'string') {
      return (path: string) => matchGlob(path, pattern);
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
  private knownFiles = new Set<string>();
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
    this.knownFiles = new Set(files);
    dirsToWatch.forEach((dirToWatch) => {
      // SPIKE: Node's own recursive watcher instead of chokidar
      const pending = new Map<string, NodeJS.Timeout>();

      const onSettled = (file: string) => {
        pending.delete(file);
        if (this.paused) {
          return;
        }
        let stats: Stats | undefined;
        try {
          stats = statSync(file);
        } catch (error) {
          // the file is gone
        }
        if (stats && !stats.isFile()) {
          return;
        }

        if (stats) {
          debug('Detected new file add', file);
          this.deletedFiles.delete(file);
          updateFilesChange(this.compiler, { changedFiles: [file] });

          this.watcher?._onChange(dirToWatch, stats.mtimeMs || stats.ctimeMs || 1, file, 'rename');
        } else {
          if (this.deletedFiles.has(file)) {
            debug('Skipping duplicated unlink event.');
            return;
          }
          debug('Detected new file remove', file);
          this.deletedFiles.add(file);
          updateFilesChange(this.compiler, { deletedFiles: [file] });

          this.watcher?._onRemove(dirToWatch, file, 'rename');
        }
      };

      let dirWatcher: FSWatcher;
      try {
        dirWatcher = watch(dirToWatch, { recursive: true }, (eventType, fileName) => {
          if (this.paused || !fileName) {
            return;
          }
          const file = join(dirToWatch, fileName);
          const supportedExtensions = this.pluginState.lastDependencies?.extensions || [];
          if (!supportedExtensions.includes(extname(file)) || isIgnored(file)) {
            return;
          }
          // webpack's own watcher reports the files it already knows
          if (this.knownFiles.has(file)) {
            return;
          }

          // a file is often written in several steps - wait until it settles
          clearTimeout(pending.get(file));
          pending.set(
            file,
            setTimeout(() => onSettled(file), SETTLE_DELAY)
          );
        });
      } catch (error) {
        // the directory doesn't exist (yet) - try again on the next watch call
        debug('Cannot watch directory', dirToWatch, error);
        return;
      }
      dirWatcher.on('error', (error) => {
        debug('Directory watcher failed', dirToWatch, error);
        dirWatcher.close();
        this.dirsWatchers.delete(dirToWatch);
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
