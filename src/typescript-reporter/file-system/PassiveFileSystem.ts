import { dirname, normalize } from 'path';
import { fs as mem } from 'memfs';
import { FileSystem } from './FileSystem';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { Dirent, Stats } from 'fs';

/**
 * It's an implementation of FileSystem interface which reads from the real file system, but write to the in-memory file system.
 *
 * @param caseSensitive
 * @param realFileSystem
 */
function createPassiveFileSystem(caseSensitive = false, realFileSystem: FileSystem): FileSystem {
  function normalizePath(path: string): string {
    return caseSensitive ? normalize(path) : normalize(path).toLowerCase();
  }

  function memExists(path: string): boolean {
    return mem.existsSync(normalizePath(path));
  }

  function memReadStats(path: string): Stats | undefined {
    return memExists(path) ? mem.statSync(normalizePath(path)) : undefined;
  }

  function memReadFile(path: string, encoding?: string): string | undefined {
    if (memExists(path)) {
      return mem
        .readFileSync(normalizePath(path), { encoding: encoding as BufferEncoding })
        .toString();
    }
  }

  function memReadDir(path: string): Dirent[] {
    if (memExists(path)) {
      return mem.readdirSync(normalizePath(path), { withFileTypes: true }) as Dirent[];
    }

    return [];
  }

  function exists(path: string) {
    return realFileSystem.exists(path) || memExists(path);
  }

  function readFile(path: string, encoding?: string) {
    const fsStats = realFileSystem.readStats(path);
    const memStats = memReadStats(path);

    if (fsStats && memStats) {
      return fsStats.mtimeMs > memStats.mtimeMs
        ? realFileSystem.readFile(path, encoding)
        : memReadFile(path, encoding);
    } else if (fsStats) {
      return realFileSystem.readFile(path, encoding);
    } else if (memStats) {
      return memReadFile(path, encoding);
    }
  }

  function readDir(path: string) {
    const fsDirents = realFileSystem.readDir(path);
    const memDirents = memReadDir(path);

    // merge list of dirents from fs and mem
    return fsDirents
      .filter((fsDirent) => !memDirents.some((memDirent) => memDirent.name === fsDirent.name))
      .concat(memDirents);
  }

  function readStats(path: string) {
    const fsStats = realFileSystem.readStats(path);
    const memStats = memReadStats(path);

    if (fsStats && memStats) {
      return fsStats.mtimeMs > memStats.mtimeMs ? fsStats : memStats;
    } else if (fsStats) {
      return fsStats;
    } else if (memStats) {
      return memStats;
    }
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
      return exists(realFileSystem.realPath(path));
    },
    readFile(path: string, encoding?: string) {
      return readFile(realFileSystem.realPath(path), encoding);
    },
    readDir(path: string) {
      return readDir(realFileSystem.realPath(path));
    },
    readStats(path: string) {
      return readStats(realFileSystem.realPath(path));
    },
    realPath(path: string) {
      return realFileSystem.realPath(path);
    },
    normalizePath(path: string) {
      return normalizePath(path);
    },
    writeFile(path: string, data: string) {
      writeFile(realFileSystem.realPath(path), data);
    },
    deleteFile(path: string) {
      deleteFile(realFileSystem.realPath(path));
    },
    createDir(path: string) {
      createDir(realFileSystem.realPath(path));
    },
    updateTimes(path: string, atime: Date, mtime: Date) {
      updateTimes(realFileSystem.realPath(path), atime, mtime);
    },
    clearCache() {
      realFileSystem.clearCache();
    },
  };
}

export { createPassiveFileSystem };
