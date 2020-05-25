import { dirname, basename, join, normalize } from 'path';
import fs from 'fs-extra';
import { fs as mem } from 'memfs';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { Stats, Dirent } from 'fs';

interface PassiveFileSystem {
  // read
  exists(path: string): boolean;
  readFile(path: string, encoding?: string): string | undefined;
  readDir(path: string): Dirent[];
  readStats(path: string): Stats | undefined;
  realPath(path: string): string;
  normalizePath(path: string): string;

  // write
  writeFile(path: string, data: string): void;
  deleteFile(path: string): void;
  createDir(path: string): void;
  updateTimes(path: string, atime: Date, mtime: Date): void;

  // cache
  clearCache(): void;
}

function createPassiveFileSystem(caseSensitive = false): PassiveFileSystem {
  // read cache
  const fsExistsCache = new Map<string, boolean>();
  const fsReadStatsCache = new Map<string, Stats>();
  const fsReadFileCache = new Map<string, string | undefined>();
  const fsReadDirCache = new Map<string, Dirent[]>();
  const fsRealPathCache = new Map<string, string>();

  function normalizePath(path: string): string {
    return caseSensitive ? normalize(path) : normalize(path).toLowerCase();
  }

  // read methods
  function fsExists(path: string): boolean {
    const normalizedPath = normalizePath(path);

    if (!fsExistsCache.has(normalizedPath)) {
      fsExistsCache.set(normalizedPath, fs.existsSync(normalizedPath));
    }

    return !!fsExistsCache.get(normalizedPath);
  }

  function memExists(path: string): boolean {
    return mem.existsSync(normalizePath(path));
  }

  function fsReadStats(path: string): Stats | undefined {
    const normalizedPath = normalizePath(path);

    if (!fsReadStatsCache.has(normalizedPath)) {
      if (fsExists(normalizedPath)) {
        fsReadStatsCache.set(normalizedPath, fs.statSync(normalizedPath));
      }
    }

    return fsReadStatsCache.get(normalizedPath);
  }

  function memReadStats(path: string): Stats | undefined {
    return memExists(path) ? mem.statSync(normalizePath(path)) : undefined;
  }

  function fsReadFile(path: string, encoding?: string): string | undefined {
    const normalizedPath = normalizePath(path);

    if (!fsReadFileCache.has(normalizedPath)) {
      if (fsExists(normalizedPath)) {
        fsReadFileCache.set(
          normalizedPath,
          fs.readFileSync(normalizedPath, { encoding }).toString()
        );
      } else {
        fsReadFileCache.set(normalizedPath, undefined);
      }
    }

    return fsReadFileCache.get(normalizedPath);
  }

  function memReadFile(path: string, encoding?: string): string | undefined {
    if (memExists(path)) {
      return mem
        .readFileSync(normalizePath(path), { encoding: encoding as BufferEncoding })
        .toString();
    }
  }

  function fsReadDir(path: string): Dirent[] {
    const normalizedPath = normalizePath(path);

    if (!fsReadDirCache.has(normalizedPath)) {
      if (fsExists(normalizedPath)) {
        fsReadDirCache.set(normalizedPath, fs.readdirSync(normalizedPath, { withFileTypes: true }));
      } else {
        fsReadDirCache.set(normalizedPath, []);
      }
    }

    return fsReadDirCache.get(normalizedPath) || [];
  }

  function memReadDir(path: string): Dirent[] {
    if (memExists(path)) {
      return mem.readdirSync(normalizePath(path), { withFileTypes: true }) as Dirent[];
    }

    return [];
  }

  function exists(path: string) {
    return fsExists(path) || memExists(path);
  }

  function readFile(path: string, encoding?: string) {
    const fsStats = fsReadStats(path);
    const memStats = memReadStats(path);

    if (fsStats && memStats) {
      return fsStats.mtimeMs > memStats.mtimeMs
        ? fsReadFile(path, encoding)
        : memReadFile(path, encoding);
    } else if (fsStats) {
      return fsReadFile(path, encoding);
    } else if (memStats) {
      return memReadFile(path, encoding);
    }
  }

  function readDir(path: string) {
    const fsDirents = fsReadDir(path);
    const memDirents = memReadDir(path);

    // merge list of dirents from fs and mem
    return fsDirents
      .filter((fsDirent) => !memDirents.some((memDirent) => memDirent.name === fsDirent.name))
      .concat(memDirents);
  }

  function readStats(path: string) {
    const fsStats = fsReadStats(path);
    const memStats = memReadStats(path);

    if (fsStats && memStats) {
      return fsStats.mtimeMs > memStats.mtimeMs ? fsStats : memStats;
    } else if (fsStats) {
      return fsStats;
    } else if (memStats) {
      return memStats;
    }
  }

  function getRealPath(path: string) {
    const normalizedPath = normalizePath(path);

    if (!fsRealPathCache.has(normalizedPath)) {
      let base = normalizedPath;
      let nested = '';

      while (base !== dirname(base)) {
        if (fsExists(base)) {
          fsRealPathCache.set(normalizedPath, normalizePath(join(fs.realpathSync(base), nested)));
          break;
        }

        nested = join(basename(base), nested);
        base = dirname(base);
      }
    }

    return fsRealPathCache.get(normalizedPath) || normalizedPath;
  }

  function createDir(path: string) {
    mem.mkdirSync(normalizePath(path), { recursive: true });
  }

  function writeFile(path: string, data: string) {
    if (!memExists(dirname(path))) {
      createDir(dirname(path));
    }

    mem.writeFileSync(normalizePath(path), data);
  }

  function deleteFile(path: string) {
    if (memExists(path)) {
      mem.unlinkSync(normalizePath(path));
    }
  }

  function updateTimes(path: string, atime: Date, mtime: Date) {
    if (memExists(path)) {
      mem.utimesSync(normalizePath(path), atime, mtime);
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
      fsExistsCache.clear();
      fsReadStatsCache.clear();
      fsReadFileCache.clear();
      fsReadDirCache.clear();
      fsRealPathCache.clear();
    },
  };
}

export { createPassiveFileSystem, PassiveFileSystem };
