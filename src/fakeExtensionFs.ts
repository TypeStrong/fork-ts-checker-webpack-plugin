import * as util from 'util';

interface Dirent {
  name: string;
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

type FS = typeof import('fs');

/**
 * creates a wrapper around the `fs` module passed as `fsOriginal`
 * * all path/filenames passed to methods will be passed through `unwrapFn` before calling the `fsOriginal` method
 * * all path/filenames returned by `readdir` or `readdirSync` will be passed through `wrapFn`
 */
export function build(
  fsOriginal: FS,
  unwrapFn: (path: string) => string,
  wrapFn: (path: string) => string
): any {
  const fakeFs = { ...fsOriginal };

  for (const method of rewritableMethods) {
    if (typeof fakeFs[method] !== 'function') {
      continue;
    }

    /**
     * we need to create identity wrappers of the original methods, as `fsOriginal[method][util.promisify.custom]` cannot be proxied directly
     */
    fakeFs[method] = (...args: any) => fsOriginal[method].apply(fakeFs, args);
    if (fsOriginal[method][util.promisify.custom]) {
      fakeFs[method][util.promisify.custom] = (...args: any[]) =>
        fsOriginal[method][util.promisify.custom].apply(fakeFs[method], args);
    }

    fakeFs[method] = proxyFunction(
      fakeFs[method],
      { apply: handlePathArgument },
      { apply: handlePathArgument }
    );
  }

  fakeFs['readdir'] = proxyFunction(
    fakeFs['readdir'],
    { apply: handleReaddirResultCallback },
    { apply: handleReaddirPromisifiedResult }
  );

  fakeFs['readdirSync'] = proxyFunction(fakeFs['readdirSync'], {
    apply: handleReaddirSyncReturnValue
  });

  fakeFs['watch'] = proxyFunction(fakeFs['watch'], {
    apply: handleWatch
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
    return target.apply(
      thisArg,
      handleCallbackArg(
        args,
        callback => (err: Error, files: (string | Buffer | Dirent)[]) =>
          callback(err, files.map(wrapFilenameInResult))
      )
    );
  }

  /**
   * function proxy handler to wrap the results of the promisified `fs.readdir` function
   */
  function handleReaddirPromisifiedResult(
    target: any,
    thisArg: any,
    args: any[]
  ) {
    return target.apply(thisArg, args).then(wrapFilenameInResult);
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
      wrapFilenameInResult
    );
  }

  /**
   * function proxy handler to wrap the callback passed to the `fs.watch` function and all callbacks passed to the returned EventEmitter for the 'change' event
   */
  function handleWatch(target: any, thisArg: any, args: any[]) {
    const eventEmitter = target.apply(
      thisArg,
      handleCallbackArg(args, wrapListenerCallback)
    );

    eventEmitter.on = new Proxy(eventEmitter.on, {
      apply: handleFsWatcherOn
    });

    return eventEmitter;
  }

  /**
   * function proxy handler to wrapp callbacks to `EventEmitter.on` for 'change' events
   */
  function handleFsWatcherOn(target: any, thisArg: any, args: any[]) {
    if (args[0] === 'change') {
      return target.apply(
        thisArg,
        handleCallbackArg(args, wrapListenerCallback)
      );
    }
    return target.apply(thisArg, args);
  }

  /**
   * wrapper function for filesystem change listener callbacks
   */
  function wrapListenerCallback(
    callback: (eventType: string, fileName: string | Buffer) => void
  ) {
    return (eventType: string, fileName: string | Buffer) =>
      callback(eventType, wrapFilenameInResult(fileName));
  }

  /**
   * Used to wrap callback parameters.
   * If the last argument is a function, wrap it in `wrapCallbackFunction`.
   * Returns a new array.
   */
  function handleCallbackArg<CB extends Function, T extends any[]>(
    args: T,
    wrapCallbackFunction: (cb: CB) => CB
  ): T {
    if (args.length > 1) {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        return [...args.slice(0, -1), wrapCallbackFunction(callback)] as T;
      }
    }
    return [...args] as T;
  }

  function wrapFilenameInResult<T extends string | Buffer | Dirent>(file: T): T;
  function wrapFilenameInResult(file: string | Buffer | Dirent) {
    if (typeof file === 'string') {
      return wrapFn(file);
    } else if (Buffer.isBuffer(file)) {
      return Buffer.from(wrapFn(file.toString()));
    } else {
      file.name = wrapFn(file.name);
      return file;
    }
  }
}

/**
 * shorthand method to create a proxy on the method, and if applicable a proxy on the promisify symbol
 */
function proxyFunction<F extends Function>(
  func: F,
  handler: ProxyHandler<F>,
  promisifyHandler?: ProxyHandler<Function>
) {
  let ret = new Proxy(func, handler);
  if (promisifyHandler && ret[util.promisify.custom]) {
    const promisify = new Proxy(ret[util.promisify.custom], promisifyHandler);
    ret = new Proxy(ret, {
      get(target, prop) {
        if (prop === util.promisify.custom) {
          return promisify;
        }
        return target[prop];
      }
    });
  }
  return ret;
}
