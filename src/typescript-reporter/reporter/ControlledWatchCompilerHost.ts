import * as ts from 'typescript';
import { TypeScriptHostExtension } from '../extension/TypeScriptExtension';
import { ControlledTypeScriptSystem } from './ControlledTypeScriptSystem';

function createControlledWatchCompilerHost<TProgram extends ts.BuilderProgram>(
  configFileName: string,
  optionsToExtend: ts.CompilerOptions | undefined,
  system: ControlledTypeScriptSystem,
  createProgram?: ts.CreateProgram<TProgram>,
  reportDiagnostic?: ts.DiagnosticReporter,
  reportWatchStatus?: ts.WatchStatusReporter,
  afterProgramCreate?: (program: TProgram) => void,
  hostExtensions: TypeScriptHostExtension[] = []
): ts.WatchCompilerHostOfConfigFile<TProgram> {
  const baseWatchCompilerHost = ts.createWatchCompilerHost(
    configFileName,
    optionsToExtend,
    system,
    createProgram,
    reportDiagnostic,
    reportWatchStatus
  );

  const parsedCommendLine = ts.getParsedCommandLineOfConfigFile(
    configFileName,
    optionsToExtend || {},
    {
      fileExists: baseWatchCompilerHost.fileExists,
      readFile: baseWatchCompilerHost.readFile,
      readDirectory: baseWatchCompilerHost.readDirectory,
      useCaseSensitiveFileNames: baseWatchCompilerHost.useCaseSensitiveFileNames(),
      getCurrentDirectory: baseWatchCompilerHost.getCurrentDirectory,
      trace: baseWatchCompilerHost.trace,
      // it's already registered in the watchCompilerHost
      onUnRecoverableConfigFileDiagnostic: () => null,
    }
  );

  let controlledWatchCompilerHost: ts.WatchCompilerHostOfConfigFile<TProgram> = {
    ...baseWatchCompilerHost,
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

      return baseWatchCompilerHost.createProgram(
        rootNames,
        options,
        compilerHost,
        oldProgram,
        configFileParsingDiagnostics,
        projectReferences
      );
    },
    afterProgramCreate(program) {
      if (afterProgramCreate) {
        afterProgramCreate(program);
      }
    },
    onWatchStatusChange(): void {
      // do nothing
    },
    watchFile: system.watchFile,
    watchDirectory: system.watchDirectory,
    setTimeout: system.setTimeout,
    clearTimeout: system.clearTimeout,
    fileExists: system.fileExists,
    readFile: system.readFile,
    directoryExists: system.directoryExists,
    getDirectories: system.getDirectories,
    realpath: system.realpath,
  };

  hostExtensions.forEach((hostExtension) => {
    if (hostExtension.extendWatchCompilerHost) {
      controlledWatchCompilerHost = hostExtension.extendWatchCompilerHost<
        TProgram,
        ts.WatchCompilerHostOfConfigFile<TProgram>
      >(controlledWatchCompilerHost, parsedCommendLine);
    }
  });

  return controlledWatchCompilerHost;
}

export { createControlledWatchCompilerHost };
