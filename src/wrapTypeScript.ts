/* tslint:disable:no-console */
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
import { extname } from 'path';
import { handleMdxContents } from './handleMdxContents';
import { handleVueContents } from './handleVueContents';

export interface TypeScriptWrapperConfig {
  extensionHandlers: {
    [extension: string]: (
      originalContents: string,
      originalFileName: string
    ) => string;
  };
  wrapExtensionsAsTs: string[];
  wrapExtensionsAsTsx: string[];
}

export const wrapperConfigWithVue: TypeScriptWrapperConfig = {
  extensionHandlers: {
    '.mdx': handleMdxContents,
    '.vue': handleVueContents,
    '.vuex': handleVueContents
  },
  wrapExtensionsAsTs: ['.vue'],
  wrapExtensionsAsTsx: ['.mdx', '.vuex']
};

export const emptyWrapperConfig: TypeScriptWrapperConfig = {
  extensionHandlers: {},
  wrapExtensionsAsTs: [],
  wrapExtensionsAsTsx: []
};

export function getWrapperUtils(
  config: TypeScriptWrapperConfig = emptyWrapperConfig
) {
  const SUFFIX_TS = '.__fake__.ts';
  const SUFFIX_TSX = '.__fake__.tsx';
  return {
    watchExtensions: [
      '.ts',
      '.tsx',
      ...config.wrapExtensionsAsTs,
      ...config.wrapExtensionsAsTsx
    ],

    wrapFileName(fileName: string) {
      return config.wrapExtensionsAsTs.some(ext => fileName.endsWith(ext))
        ? fileName.concat(SUFFIX_TS)
        : config.wrapExtensionsAsTsx.some(ext => fileName.endsWith(ext))
        ? fileName.concat(SUFFIX_TSX)
        : fileName;
    },

    unwrapFileName(fileName: string) {
      if (fileName.endsWith(SUFFIX_TS)) {
        const realFileName = fileName.slice(0, -SUFFIX_TS.length);
        if (config.wrapExtensionsAsTs.includes(extname(realFileName))) {
          return realFileName;
        }
      }
      if (fileName.endsWith(SUFFIX_TSX)) {
        const realFileName = fileName.slice(0, -SUFFIX_TSX.length);
        if (config.wrapExtensionsAsTsx.includes(extname(realFileName))) {
          return realFileName;
        }
      }
      return fileName;
    }
  };
}

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

  const wrappers: Partial<ts.System> = {
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

  const systemHandler: ProxyHandler<ts.System> = {
    get(target, name: string) {
      if (
        typeof target[name] === 'function' &&
        typeof wrappers[name] === 'function'
      ) {
        return wrappers[name].bind(target);
      }
      return target[name];
    }
  };

  const sysProxy = new Proxy<ts.System>(
    typescript.sys,
    // log unwrapped calls & results
    // new Proxy<ts.System>(typescript.sys, loggingHandler),
    systemHandler
  );

  return {
    ...typescript,
    sys: sysProxy
    // log wrapped calls & results
    // sys: new Proxy<ts.System>(sysProxy, loggingHandler)
  };
}

type PickDefined<T, K extends keyof T> = { [Key in K]-?: NonNullable<T[K]> };
type HostType = ts.CompilerHost | ts.WatchCompilerHostOfConfigFile<any>;

export function wrapCompilerHost<T extends HostType>(
  host: T,
  programConfig: ts.ParsedCommandLine,
  typescript: typeof ts,
  _config: TypeScriptWrapperConfig
) {
  const wrapSuffixes = ['', '.__fake__'];

  const compilerHostWrappers: PickDefined<HostType, 'resolveModuleNames'> = {
    resolveModuleNames(
      this: HostType,
      moduleNames,
      containingFile,
      _reusedNames, // no idea what this is for
      redirectedReference
    ) {
      return moduleNames.map(moduleName => {
        for (const suffix of wrapSuffixes) {
          /*
          console.log(
            START_YELLOW,
            'try resolving',
            moduleName + suffix,
            RESET
          );
          */
          const result = typescript.resolveModuleName(
            moduleName + suffix,
            containingFile,
            programConfig.options,
            this,
            undefined,
            redirectedReference
          );
          if (result.resolvedModule) {
            /*
            console.log(
              START_YELLOW,
              'resolved',
              moduleName,
              'as',
              result.resolvedModule.resolvedFileName,
              RESET
            );
            */
            return result.resolvedModule;
          }
        }
        // console.log(START_RED, 'could not revolve', moduleName, RESET);
        return undefined;
      });
    }
  };

  const handler: ProxyHandler<HostType> = {
    get(target, name: string) {
      if (typeof compilerHostWrappers[name] === 'function') {
        return compilerHostWrappers[name].bind(target);
      }
      return target[name];
    }
  };

  return new Proxy<T>(host, handler) as T & typeof compilerHostWrappers;
}

// @ts-ignore
const START_YELLOW = '\x1b[33m';
// @ts-ignore
const START_RED = '\x1b[31m';
// @ts-ignore
const RESET = '\x1b[0m';
