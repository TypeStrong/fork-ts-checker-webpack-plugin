interface Dirent {
  path: string;
}

/**
 * names of methods that can receive a path/filename as first argument
 */
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

/**
 * creates a wrapper around the `fs` module passed as `fsOriginal`
 * * all path/filenames passed to methods will be passed through `unwrapFn` before calling the `fsOriginal` method
 * * all path/filenames returned by `readdir` or `readdirSync` will be passed through `wrapFn`
 */
export function build(
  fsOriginal: typeof import('fs'),
  unwrapFn: (path: string) => string,
  wrapFn: (path: string) => string
): any {
  const fakeFs = { ...fsOriginal };

  for (const method of rewritableMethods) {
    if (typeof fakeFs[method] !== 'function') {
      continue;
    }
    fakeFs[method] = new Proxy(fakeFs[method], {
      apply: handlePathArgument
    });
  }

  fakeFs['readdir'] = new Proxy(fakeFs['readdir'], {
    apply: handleReaddirResultCallback
  });

  fakeFs['readdirSync'] = new Proxy(fakeFs['readdirSync'], {
    apply: handleReaddirSyncReturnValue
  });

  return fakeFs;

  /**
   * function proxy handler to wrap the path/filename that is passed as first argument to many `fs` functions
   */
  function handlePathArgument(target: any, thisArg: any, args: any[]) {
    if (typeof args[0] === 'string') {
      args[0] = unwrapFn(args[0]);
    }
    return target.apply(thisArg, args);
  }

  /**
   * function proxy handler to wrap the results passed to the callback of the `fs.readdir` function
   */
  function handleReaddirResultCallback(target: any, thisArg: any, args: any[]) {
    if (args.length > 1) {
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
    return target.apply(thisArg, args);
  }

  /**
   * function proxy handler to wrap the results returned by the `fs.readdirSync` function
   */
  function handleReaddirSyncReturnValue(
    target: any,
    thisArg: any,
    args: any[]
  ) {
    return (target.apply(thisArg, args) as (string | Buffer | Dirent)[]).map(
      wrapReaddirResult
    );
  }

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
