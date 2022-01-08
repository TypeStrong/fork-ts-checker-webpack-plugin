import type { Dirent, Stats } from 'fs';
import { dirname } from 'path';

import { fs as mem } from 'memfs';

import type { FileSystem } from './file-system';
import { realFileSystem } from './real-file-system';

/**
 * It's an implementation of FileSystem interface which reads and writes to the in-memory file system.
 */
export const memFileSystem: FileSystem = {
  ...realFileSystem,
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

function exists(path: string): boolean {
  return mem.existsSync(realFileSystem.normalizePath(path));
}

function readStats(path: string): Stats | undefined {
  return exists(path) ? mem.statSync(realFileSystem.normalizePath(path)) : undefined;
}

function readFile(path: string, encoding?: string): string | undefined {
  const stats = readStats(path);

  if (stats && stats.isFile()) {
    return mem
      .readFileSync(realFileSystem.normalizePath(path), { encoding: encoding as BufferEncoding })
      .toString();
  }
}

function readDir(path: string): Dirent[] {
  const stats = readStats(path);

  if (stats && stats.isDirectory()) {
    return mem.readdirSync(realFileSystem.normalizePath(path), {
      withFileTypes: true,
    }) as Dirent[];
  }

  return [];
}

function createDir(path: string) {
  mem.mkdirSync(realFileSystem.normalizePath(path), { recursive: true });
}

function writeFile(path: string, data: string) {
  if (!exists(dirname(path))) {
    createDir(dirname(path));
  }

  mem.writeFileSync(realFileSystem.normalizePath(path), data);
}

function deleteFile(path: string) {
  if (exists(path)) {
    mem.unlinkSync(realFileSystem.normalizePath(path));
  }
}

function updateTimes(path: string, atime: Date, mtime: Date) {
  if (exists(path)) {
    mem.utimesSync(realFileSystem.normalizePath(path), atime, mtime);
  }
}
