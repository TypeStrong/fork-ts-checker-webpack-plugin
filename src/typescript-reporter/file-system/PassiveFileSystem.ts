import { FileSystem } from './FileSystem';

/**
 * It's an implementation of FileSystem interface which reads from the real file system, but write to the in-memory file system.
 *
 * @param memFileSystem
 * @param realFileSystem
 */
function createPassiveFileSystem(
  memFileSystem: FileSystem,
  realFileSystem: FileSystem
): FileSystem {
  function exists(path: string) {
    return realFileSystem.exists(path) || memFileSystem.exists(path);
  }

  function readFile(path: string, encoding?: string) {
    const fsStats = realFileSystem.readStats(path);
    const memStats = memFileSystem.readStats(path);

    if (fsStats && memStats) {
      return fsStats.mtimeMs > memStats.mtimeMs
        ? realFileSystem.readFile(path, encoding)
        : memFileSystem.readFile(path, encoding);
    } else if (fsStats) {
      return realFileSystem.readFile(path, encoding);
    } else if (memStats) {
      return memFileSystem.readFile(path, encoding);
    }
  }

  function readDir(path: string) {
    const fsDirents = realFileSystem.readDir(path);
    const memDirents = memFileSystem.readDir(path);

    // merge list of dirents from fs and mem
    return fsDirents
      .filter((fsDirent) => !memDirents.some((memDirent) => memDirent.name === fsDirent.name))
      .concat(memDirents);
  }

  function readStats(path: string) {
    const fsStats = realFileSystem.readStats(path);
    const memStats = memFileSystem.readStats(path);

    if (fsStats && memStats) {
      return fsStats.mtimeMs > memStats.mtimeMs ? fsStats : memStats;
    } else if (fsStats) {
      return fsStats;
    } else if (memStats) {
      return memStats;
    }
  }

  return {
    ...memFileSystem,
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
    clearCache() {
      realFileSystem.clearCache();
    },
  };
}

export { createPassiveFileSystem };
