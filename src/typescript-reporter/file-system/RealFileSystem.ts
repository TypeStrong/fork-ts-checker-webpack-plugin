import { dirname, basename, join, normalize } from 'path';
import fs from 'fs-extra';
import { FileSystem } from './FileSystem';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { Dirent, Stats } from 'fs';

/**
 * It's an implementation of the FileSystem interface which reads and writes directly to the real file system.
 *
 * @param caseSensitive
 */
function createRealFileSystem(caseSensitive = false): FileSystem {
  // read cache
  const existsCache = new Map<string, boolean>();
  const readStatsCache = new Map<string, Stats>();
  const readFileCache = new Map<string, string | undefined>();
  const readDirCache = new Map<string, Dirent[]>();
  const realPathCache = new Map<string, string>();

  function normalizePath(path: string): string {
    return caseSensitive ? normalize(path) : normalize(path).toLowerCase();
  }

  // read methods
  function exists(path: string): boolean {
    const normalizedPath = normalizePath(path);

    if (!existsCache.has(normalizedPath)) {
      existsCache.set(normalizedPath, fs.existsSync(normalizedPath));
    }

    return !!existsCache.get(normalizedPath);
  }

  function readStats(path: string): Stats | undefined {
    const normalizedPath = normalizePath(path);

    if (!readStatsCache.has(normalizedPath)) {
      if (exists(normalizedPath)) {
        readStatsCache.set(normalizedPath, fs.statSync(normalizedPath));
      }
    }

    return readStatsCache.get(normalizedPath);
  }

  function readFile(path: string, encoding?: string): string | undefined {
    const normalizedPath = normalizePath(path);

    if (!readFileCache.has(normalizedPath)) {
      const stats = readStats(normalizedPath);

      if (stats && stats.isFile()) {
        readFileCache.set(normalizedPath, fs.readFileSync(normalizedPath, { encoding }).toString());
      } else {
        readFileCache.set(normalizedPath, undefined);
      }
    }

    return readFileCache.get(normalizedPath);
  }

  function readDir(path: string): Dirent[] {
    const normalizedPath = normalizePath(path);

    if (!readDirCache.has(normalizedPath)) {
      const stats = readStats(normalizedPath);

      if (stats && stats.isDirectory()) {
        readDirCache.set(normalizedPath, fs.readdirSync(normalizedPath, { withFileTypes: true }));
      } else {
        readDirCache.set(normalizedPath, []);
      }
    }

    return readDirCache.get(normalizedPath) || [];
  }

  function getRealPath(path: string) {
    const normalizedPath = normalizePath(path);

    if (!realPathCache.has(normalizedPath)) {
      let base = normalizedPath;
      let nested = '';

      while (base !== dirname(base)) {
        if (exists(base)) {
          realPathCache.set(normalizedPath, normalizePath(join(fs.realpathSync(base), nested)));
          break;
        }

        nested = join(basename(base), nested);
        base = dirname(base);
      }
    }

    return realPathCache.get(normalizedPath) || normalizedPath;
  }

  function createDir(path: string) {
    const normalizedPath = normalizePath(path);

    fs.mkdirSync(normalizedPath, { recursive: true });

    // update cache
    existsCache.set(normalizedPath, true);
    if (readDirCache.has(dirname(normalizedPath))) {
      readDirCache.delete(dirname(normalizedPath));
    }
    if (readStatsCache.has(normalizedPath)) {
      readStatsCache.delete(normalizedPath);
    }
  }

  function writeFile(path: string, data: string) {
    const normalizedPath = normalizePath(path);

    if (!exists(dirname(normalizedPath))) {
      createDir(dirname(normalizedPath));
    }

    fs.writeFileSync(normalizedPath, data);

    // update cache
    existsCache.set(normalizedPath, true);
    if (readDirCache.has(dirname(normalizedPath))) {
      readDirCache.delete(dirname(normalizedPath));
    }
    if (readStatsCache.has(normalizedPath)) {
      readStatsCache.delete(normalizedPath);
    }
    if (readFileCache.has(normalizedPath)) {
      readFileCache.delete(normalizedPath);
    }
  }

  function deleteFile(path: string) {
    if (exists(path)) {
      const normalizedPath = normalizePath(path);

      fs.unlinkSync(normalizedPath);

      // update cache
      existsCache.set(normalizedPath, false);
      if (readDirCache.has(dirname(normalizedPath))) {
        readDirCache.delete(dirname(normalizedPath));
      }
      if (readStatsCache.has(normalizedPath)) {
        readStatsCache.delete(normalizedPath);
      }
      if (readFileCache.has(normalizedPath)) {
        readFileCache.delete(normalizedPath);
      }
    }
  }

  function updateTimes(path: string, atime: Date, mtime: Date) {
    if (exists(path)) {
      const normalizedPath = normalizePath(path);

      fs.utimesSync(normalizePath(path), atime, mtime);

      // update cache
      if (readStatsCache.has(normalizedPath)) {
        readStatsCache.delete(normalizedPath);
      }
    }
  }

  return {
    exists(path: string) {
      return exists(getRealPath(path));
    },
    readFile(path: string, encoding?: string) {
      return readFile(getRealPath(path), encoding);
    },
    readDir(path: string) {
      return readDir(getRealPath(path));
    },
    readStats(path: string) {
      return readStats(getRealPath(path));
    },
    realPath(path: string) {
      return getRealPath(path);
    },
    normalizePath(path: string) {
      return normalizePath(path);
    },
    writeFile(path: string, data: string) {
      writeFile(getRealPath(path), data);
    },
    deleteFile(path: string) {
      deleteFile(getRealPath(path));
    },
    createDir(path: string) {
      createDir(getRealPath(path));
    },
    updateTimes(path: string, atime: Date, mtime: Date) {
      updateTimes(getRealPath(path), atime, mtime);
    },
    clearCache() {
      existsCache.clear();
      readStatsCache.clear();
      readFileCache.clear();
      readDirCache.clear();
      realPathCache.clear();
    },
  };
}

export { createRealFileSystem };
