/* tslint:disable:no-console */
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
import { extname } from 'path';
import { handleMdxContents } from './handleMdxContents';

const extensionHandlers: {
  [extension: string]: (
    originalContents: string,
    originalFileName: string
  ) => string;
} = {
  '.mdx': handleMdxContents
};
const wrapExtensionsAsTs: string[] = [];
const wrapExtensionsAsTsx: string[] = ['.mdx'];

const SUFFIX_TS = '.__fake__.ts';
const SUFFIX_TSX = '.__fake__.tsx';
const wrapFileName = (fileName: string) =>
  wrapExtensionsAsTs.some(ext => fileName.endsWith(ext))
    ? fileName.concat(SUFFIX_TS)
    : wrapExtensionsAsTsx.some(ext => fileName.endsWith(ext))
    ? fileName.concat(SUFFIX_TSX)
    : fileName;
const unwrapFileName = (fileName: string) =>
  fileName.endsWith(SUFFIX_TS)
    ? fileName.slice(0, -SUFFIX_TS.length)
    : fileName.endsWith(SUFFIX_TSX)
    ? fileName.slice(0, -SUFFIX_TSX.length)
    : fileName;
const handleFileContents = (
  originalFileName: string,
  originalContents?: string
) => {
  const handler = extensionHandlers[extname(originalFileName)];
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
        ...wrapExtensionsAsTs,
        ...wrapExtensionsAsTsx
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

export const loggingHandler: ProxyHandler<{}> = {
  get(target, name) {
    if (typeof target[name] !== 'function') {
      console.log('get', name, '=', target[name]);
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

export function wrapTypescript(typescript: typeof ts) {
  return {
    ...typescript,
    sys: new Proxy(
      typescript.sys,
      // new Proxy<ts.System>(typescript.sys, loggingHandler),
      systemHandler
    )
  };
}
