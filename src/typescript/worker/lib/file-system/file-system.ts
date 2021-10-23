// eslint-disable-next-line node/no-unsupported-features/node-builtins
import type { Dirent, Stats } from 'fs';

/**
 * Interface to abstract file system implementation details.
 */
export interface FileSystem {
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
