/**
 * loosely based on [linkfs](https://github.com/streamich/linkfs)
 */

import * as fs from 'fs';

interface Dirent {
  path: string;
}

export const props = ['constants', 'F_OK', 'R_OK', 'W_OK', 'X_OK', 'Stats'];

export const rewritableMethods = [
  'accessSync',
  'access',
  'appendFileSync',
  'appendFile',
  'chmodSync',
  'chmod',
  'chownSync',
  'chown',
  'createReadStream',
  'createWriteStream',
  'existsSync',
  'exists',
  'lchmodSync',
  'lchmod',
  'lchownSync',
  'lchown',
  'linkSync',
  'link',
  'lstatSync',
  'lstat',
  'mkdirSync',
  'mkdir',
  'mkdtempSync',
  'mkdtemp',
  'openSync',
  'open',
  'readdirSync',
  'readdir',
  'readFileSync',
  'readFile',
  'readlinkSync',
  'readlink',
  'realpathSync',
  'realpath',
  'renameSync',
  'rename',
  'rmdirSync',
  'rmdir',
  'statSync',
  'stat',
  'symlinkSync',
  'symlink',
  'truncateSync',
  'truncate',
  'unlinkSync',
  'unlink',
  'unwatchFile',
  'utimesSync',
  'utimes',
  'watch',
  'watchFile',
  'writeFileSync',
  'writeFile'
];

export const proxyableMethods = [
  'ftruncateSync',
  'fchownSync',
  'fchmodSync',
  'fstatSync',
  'closeSync',
  'futimesSync',
  'fsyncSync',
  'writeSync',
  'readSync',
  'fdatasyncSync',
  'ftruncate',
  'fchown',
  'fchmod',
  'fstat',
  'close',
  'futimes',
  'fsync',
  'write',
  'read',
  'fdatasync',
  '_toUnixTimestamp'
];

export function build(
  fsOriginal: typeof fs,
  unwrapFn: (path: string) => string,
  wrapFn: (path: string) => string
): any {
  const lfs: typeof fs = {} as any;

  // Rewrite the path of the selected methods.
  for (const method of rewritableMethods) {
    const func = fsOriginal[method];
    if (typeof func !== 'function') {
      lfs[method] = fsOriginal[method];
    }

    lfs[method] = (...args: any[]) => {
      let path = args[0];
      if (typeof path === 'string' || Buffer.isBuffer(path)) {
        path = unwrapFn(String(path));
        args[0] = path;
      }

      if (method === 'readdir' && args.length > 1) {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          args[args.length - 1] = (
            err: Error,
            files: (string | Buffer | Dirent)[]
          ) => {
            callback(err, files.map(wrapReaddirResult));
          };
        }
      }

      const result = func.apply(fsOriginal, args);

      if (method === 'readdirSync') {
        return (result as any[]).map(wrapReaddirResult);
      } else {
        return result;
      }
    };
  }

  // Just proxy the rest of the methods.
  for (const method of proxyableMethods) {
    const func = fsOriginal[method];
    if (typeof func !== 'function') {
      continue;
    }

    lfs[method] = func.bind(fsOriginal);
  }

  return lfs;

  function wrapReaddirResult(file: string | Buffer | Dirent) {
    if (typeof file === 'string') {
      return wrapFn(file);
    } else if (Buffer.isBuffer(file)) {
      // not going to handle buffers right now...
      return file;
    } else {
      file.path = wrapFn(file.path);
      return file;
    }
  }
}
