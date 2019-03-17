/* tslint:disable:no-console */
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
import { extname } from 'path';
import { TypeScriptWrapperConfig, getWrapperUtils } from './wrapperUtils';
import { wrapCompilerHost } from './wrapCompilerHost';

export function wrapTypescript(
  typescript: typeof ts,
  config: TypeScriptWrapperConfig
) {
  const { wrapFileName, unwrapFileName } = getWrapperUtils(config);

  const handleFileContents = (
    originalFileName: string,
    originalContents?: string
  ) => {
    const handler = config.extensionHandlers[extname(originalFileName)];
    return handler && originalContents
      ? handler(originalContents, originalFileName)
      : originalContents;
  };

  // @ts-ignore
  const wrapWatcherCallback = <
    T extends ts.FileWatcherCallback | ts.DirectoryWatcherCallback
  >(
    callback: T
  ) =>
    ((unwrappedFileName: string, ...args: any[]) => {
      /*
    console.log(
      'watcherCallback(',
      wrapFileName(unwrappedFileName),
      ...args,
      ')'
    );
    */
      (callback as any)(wrapFileName(unwrappedFileName), ...args);
    }) as T;

  const origFileExtensions = ['.ts', '.tsx', '.d.ts'];

  function arrayContentsEqual(
    a: ReadonlyArray<string>,
    b: ReadonlyArray<string>
  ) {
    return a.length === b.length && b.every(item => a.includes(item));
  }

  const systemWrappers: Partial<ts.System> = {
    readDirectory(this: ts.System, path, extensions, ...rest) {
      if (extensions && arrayContentsEqual(extensions, origFileExtensions)) {
        extensions = [
          ...extensions,
          ...config.wrapExtensionsAsTs,
          ...config.wrapExtensionsAsTsx
        ];
      }
      return this.readDirectory(path, extensions, ...rest).map(wrapFileName);
    },
    readFile(this: ts.System, fileName, ...rest) {
      const originalFileName = unwrapFileName(fileName);
      return handleFileContents(
        originalFileName,
        this.readFile(unwrapFileName(fileName), ...rest)
      );
    },
    fileExists(this: ts.System, fileName) {
      return this.fileExists(unwrapFileName(fileName));
    },
    watchFile(this: ts.System, fileName, callback, ...rest) {
      return this.watchFile!(
        unwrapFileName(fileName),
        wrapWatcherCallback(callback),
        ...rest
      );
    },
    watchDirectory(this: ts.System, dirName, callback, ...rest) {
      return this.watchDirectory!(
        dirName,
        wrapWatcherCallback(callback),
        ...rest
      );
    },
    getModifiedTime(this: ts.System, fileName) {
      return this.getModifiedTime!(unwrapFileName(fileName));
    },
    setModifiedTime(this: ts.System, fileName, ...args) {
      return this.setModifiedTime!(unwrapFileName(fileName), ...args);
    },
    deleteFile(this: ts.System, fileName) {
      return this.deleteFile!(unwrapFileName(fileName));
    }
  };

  // @ts-ignore
  const loggingHandler: ProxyHandler<{}> = {
    get(target, name) {
      if (typeof target[name] !== 'function') {
        // console.log('get', name, '=', target[name]);
        return target[name];
      }

      return (...args: any) => {
        if (!/node_modules/g.test(args[0])) {
          console.log(name, '(', ...args, ')');
        }
        const result = target[name](...args);
        if (!/node_modules/g.test(args[0])) {
          console.log(
            `# result for `,
            name,
            '(',
            ...args,
            '):',
            typeof result === 'string' ? JSON.stringify(result) : result
          );
        }
        return result;
      };
    }
  };

  const sysProxy = new Proxy<ts.System>(
    typescript.sys,
    // log unwrapped calls & results
    // new Proxy<ts.System>(typescript.sys, loggingHandler),
    {
      get(target, name: string) {
        if (systemWrappers[name] && target[name]) {
          if (typeof systemWrappers[name] === 'function') {
            return systemWrappers[name].bind(target);
          }
          return systemWrappers[name];
        }

        return target[name];
      }
    }
  );

  const typescriptWrappers: Partial<typeof ts> = {
    sys: sysProxy,
    createCompilerHost(options, setParentNodes) {
      return wrapCompilerHost(
        /*
         * unfortunately, ts.createCompilerHost does not take a "system" argument.
         * but the internal (and exposed) createCompilerHostWorker does
         * this is a bit hacky and might break in the future :/
         * (a more solid workaround would be implementing another
         * own CompilerHost or using the existing one if it is fit for the task?)
         */
        (this as any).createCompilerHostWorker(
          options,
          setParentNodes,
          tsProxy.sys
        ) as ts.CompilerHost,
        options,
        tsProxy,
        config
      );
    },
    createWatchCompilerHost(
      fileOrFiles: any,
      options: ts.CompilerOptions | undefined,
      _system: any,
      ...args: any[]
    ) {
      if (!options) {
        throw new Error('CompilerOptions are required!');
      }
      return wrapCompilerHost(
        (this.createWatchCompilerHost as any)(
          fileOrFiles,
          options,
          tsProxy.sys,
          ...args
        ),
        options,
        tsProxy,
        config
      );
    }
  };

  const tsProxy = new Proxy<typeof ts>(typescript, {
    get(target, name: string) {
      if (typescriptWrappers[name] && target[name]) {
        if (typeof typescriptWrappers[name] === 'function') {
          return typescriptWrappers[name].bind(target);
        }
        return typescriptWrappers[name];
      }
      return target[name];
    }
  });

  return tsProxy;
}
