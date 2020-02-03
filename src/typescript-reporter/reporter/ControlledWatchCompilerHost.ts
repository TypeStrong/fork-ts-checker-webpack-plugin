import { dirname } from 'path';
import * as ts from 'typescript';
import { TypeScriptHostExtension } from '../extension/TypeScriptExtension';
import { ControlledWatchHost } from './ControlledWatchHost';

interface ControlledWatchCompilerHost<TProgram extends ts.BuilderProgram>
  extends ts.WatchCompilerHostOfConfigFile<TProgram>,
    ControlledWatchHost {}

function createControlledWatchCompilerHost<TProgram extends ts.BuilderProgram>(
  configFileName: string,
  optionsToExtend: ts.CompilerOptions | undefined,
  system: ts.System,
  createProgram?: ts.CreateProgram<TProgram>,
  reportDiagnostic?: ts.DiagnosticReporter,
  reportWatchStatus?: ts.WatchStatusReporter,
  afterProgramCreate?: (program: TProgram) => void,
  hostExtensions: TypeScriptHostExtension[] = []
): ControlledWatchCompilerHost<TProgram> {
  const watchCompilerHost = ts.createWatchCompilerHost(
    configFileName,
    optionsToExtend,
    system,
    createProgram,
    reportDiagnostic,
    reportWatchStatus
  );

  const fileWatchers = new Map<string, ts.FileWatcherCallback>();
  const directoryWatchers = new Map<string, ts.DirectoryWatcherCallback>();
  const recursiveDirectoryWatchers = new Map<string, ts.DirectoryWatcherCallback>();
  const sourceFileCache = new Map<string, ts.SourceFile>();

  const parsedCommendLine = ts.getParsedCommandLineOfConfigFile(
    configFileName,
    optionsToExtend || {},
    {
      fileExists: watchCompilerHost.fileExists,
      readFile: watchCompilerHost.readFile,
      readDirectory: watchCompilerHost.readDirectory,
      useCaseSensitiveFileNames: watchCompilerHost.useCaseSensitiveFileNames(),
      getCurrentDirectory: watchCompilerHost.getCurrentDirectory,
      trace: watchCompilerHost.trace,
      // it's already registered in the watchCompilerHost
      onUnRecoverableConfigFileDiagnostic: () => null,
    }
  );

  const invokeFileWatchers = (path: string, event: ts.FileWatcherEventKind) => {
    const fileWatcher = fileWatchers.get(path);

    if (fileWatcher) {
      fileWatcher(path, event);
    }
  };

  const invokeDirectoryWatchers = (path: string) => {
    let key = dirname(path.toLowerCase());

    const directoryWatcher = directoryWatchers.get(key);
    if (directoryWatcher) {
      directoryWatcher(path);
    }

    while (key !== dirname(key)) {
      const recursiveDirectoryWatcher = recursiveDirectoryWatchers.get(key);
      if (recursiveDirectoryWatcher) {
        recursiveDirectoryWatcher(path);
      }

      key = dirname(key);
    }
  };

  let controlledWatchCompilerHost: ControlledWatchCompilerHost<TProgram> = {
    ...watchCompilerHost,
    createProgram(
      rootNames: ReadonlyArray<string> | undefined,
      options: ts.CompilerOptions | undefined,
      compilerHost?: ts.CompilerHost,
      oldProgram?: TProgram,
      configFileParsingDiagnostics?: ReadonlyArray<ts.Diagnostic>,
      projectReferences?: ReadonlyArray<ts.ProjectReference> | undefined
    ): TProgram {
      // as compilerHost is optional, ensure that we have it
      if (!compilerHost) {
        if (!options) {
          options = parsedCommendLine ? parsedCommendLine.options : undefined;
        }

        if (options) {
          compilerHost = ts.createCompilerHost(options);
        }
      }

      hostExtensions.forEach((hostExtension) => {
        if (compilerHost && hostExtension.extendCompilerHost) {
          compilerHost = hostExtension.extendCompilerHost(compilerHost, parsedCommendLine);
        }
      });

      return watchCompilerHost.createProgram(
        rootNames,
        options,
        compilerHost,
        oldProgram,
        configFileParsingDiagnostics,
        projectReferences
      );
    },
    onWatchStatusChange(): void {
      // do nothing
    },
    afterProgramCreate(program) {
      if (afterProgramCreate) {
        afterProgramCreate(program);
      }
    },
    watchFile(path: string, callback: ts.FileWatcherCallback): ts.FileWatcher {
      const key = path.toLowerCase();
      fileWatchers.set(key, callback);

      return {
        close: () => fileWatchers.delete(key),
      };
    },
    watchDirectory(
      path: string,
      callback: ts.DirectoryWatcherCallback,
      recursive = false
    ): ts.FileWatcher {
      const key = path.toLowerCase();

      if (recursive) {
        recursiveDirectoryWatchers.set(key, callback);
        return {
          close: () => recursiveDirectoryWatchers.delete(key),
        };
      } else {
        directoryWatchers.set(key, callback);
        return {
          close: () => directoryWatchers.delete(key),
        };
      }
    },
    // use immediate instead of timeout to avoid waiting 250ms for batching files changes
    setTimeout: (callback, timeout, ...args) => setImmediate(() => callback(...args)),
    clearTimeout: (timeoutId) => clearImmediate(timeoutId),
    invokeFileCreated(path: string) {
      sourceFileCache.delete(path);

      invokeDirectoryWatchers(path);
      invokeFileWatchers(path, ts.FileWatcherEventKind.Created);
    },
    invokeFileChanged(path: string) {
      sourceFileCache.delete(path);

      invokeDirectoryWatchers(path);
      invokeFileWatchers(path, ts.FileWatcherEventKind.Changed);
    },
    invokeFileDeleted(path: string) {
      sourceFileCache.delete(path);

      invokeDirectoryWatchers(path);
      invokeFileWatchers(path, ts.FileWatcherEventKind.Deleted);
    },
  };

  hostExtensions.forEach((hostExtension) => {
    if (hostExtension.extendWatchCompilerHost) {
      controlledWatchCompilerHost = hostExtension.extendWatchCompilerHost<
        TProgram,
        ControlledWatchCompilerHost<TProgram>
      >(controlledWatchCompilerHost, parsedCommendLine);
    }
  });

  return controlledWatchCompilerHost;
}

export { createControlledWatchCompilerHost, ControlledWatchCompilerHost };
