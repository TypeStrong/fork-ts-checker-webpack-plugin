/* tslint:disable:no-console */
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
import { extname } from 'path';
import { TypeScriptWrapperConfig, getWrapperUtils } from './wrapperUtils';
import { wrapCompilerHost } from './wrapCompilerHost';

export function wrapTypescript(
  origTypescript: typeof ts,
  config: TypeScriptWrapperConfig
) {
  const origSys = origTypescript.sys;
  let wrappedTypescript: typeof ts;
  let wrappedSys: ts.System;

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
    readDirectory(path, extensions, ...rest) {
      if (extensions && arrayContentsEqual(extensions, origFileExtensions)) {
        extensions = [...extensions, ...config.wrapExtensions];
      }
      return origSys.readDirectory(path, extensions, ...rest).map(wrapFileName);
    },
    readFile(fileName, ...rest) {
      const originalFileName = unwrapFileName(fileName);
      return handleFileContents(
        originalFileName,
        origSys.readFile(unwrapFileName(fileName), ...rest)
      );
    },
    fileExists(fileName) {
      return origSys.fileExists(unwrapFileName(fileName));
    },
    watchFile(fileName, callback, ...rest) {
      return origSys.watchFile!(
        unwrapFileName(fileName),
        wrapWatcherCallback(callback),
        ...rest
      );
    },
    watchDirectory(dirName, callback, ...rest) {
      return origSys.watchDirectory!(
        dirName,
        wrapWatcherCallback(callback),
        ...rest
      );
    },
    getModifiedTime(fileName) {
      return origSys.getModifiedTime!(unwrapFileName(fileName));
    },
    setModifiedTime(fileName, ...args) {
      return origSys.setModifiedTime!(unwrapFileName(fileName), ...args);
    },
    deleteFile(fileName) {
      return origSys.deleteFile!(unwrapFileName(fileName));
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

  wrappedSys = {
    ...origTypescript.sys,
    ...systemWrappers
  };
  // new Proxy<ts.System>(sysProxy, loggingHandler);

  const typescriptWrappers: Partial<typeof ts> = {
    sys: wrappedSys,
    createCompilerHost(options, setParentNodes) {
      return wrapCompilerHost(
        /*
         * unfortunately, ts.createCompilerHost does not take a "system" argument.
         * but the internal (and exposed) createCompilerHostWorker does.
         * this is a bit hacky and might break in the future :/
         * (a more solid workaround would be implementing another
         * own CompilerHost or using the existing one if it is fit for the task?)
         */
        (origTypescript as any).createCompilerHostWorker(
          options,
          setParentNodes,
          wrappedTypescript.sys
        ) as ts.CompilerHost,
        options,
        wrappedTypescript,
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
        (origTypescript.createWatchCompilerHost as any)(
          fileOrFiles,
          options,
          wrappedTypescript.sys,
          ...args
        ),
        options,
        wrappedTypescript,
        config
      );
    },
    // function createEmitAndSemanticDiagnosticsBuilderProgram(newProgram: ts.Program, host: ts.BuilderProgramHost, oldProgram?: ts.EmitAndSemanticDiagnosticsBuilderProgram, configFileParsingDiagnostics?: ReadonlyArray<ts.Diagnostic>): ts.EmitAndSemanticDiagnosticsBuilderProgram;
    // function createEmitAndSemanticDiagnosticsBuilderProgram(rootNames: ReadonlyArray<string> | undefined, options: ts.CompilerOptions | undefined, host?: CompilerHost, oldProgram?: ts.EmitAndSemanticDiagnosticsBuilderProgram, configFileParsingDiagnostics?: ReadonlyArray<ts.Diagnostic>, projectReferences?: ReadonlyArray<ts.ProjectReference>): ts.EmitAndSemanticDiagnosticsBuilderProgram;
    createEmitAndSemanticDiagnosticsBuilderProgram(...args: any[]) {
      if (isTsProgram(args[0])) {
        throw new Error(
          "only the signature 'rootNames, options, host, ... is supported for createEmitAndSemanticDiagnosticsBuilderProgram"
        );
      }
      const origOptions = args[1];
      const origHost = args[2];

      args[2] = wrapCompilerHost(
        origHost,
        origOptions,
        wrappedTypescript,
        config
      );
      return (origTypescript.createEmitAndSemanticDiagnosticsBuilderProgram as any)(
        ...args
      );
    }
  };

  wrappedTypescript = {
    ...origTypescript,
    ...typescriptWrappers
  };

  return wrappedTypescript;
}

function isTsProgram(
  x: ReadonlyArray<string> | undefined | ts.Program
): x is ts.Program {
  return !!x && 'getRootFileNames' in x;
}
