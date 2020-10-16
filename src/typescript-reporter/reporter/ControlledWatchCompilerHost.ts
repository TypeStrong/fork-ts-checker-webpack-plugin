import * as ts from 'typescript';
import { TypeScriptHostExtension } from '../extension/TypeScriptExtension';
import { ControlledTypeScriptSystem } from './ControlledTypeScriptSystem';

function createControlledWatchCompilerHost<TProgram extends ts.BuilderProgram>(
  typescript: typeof ts,
  parsedCommandLine: ts.ParsedCommandLine,
  system: ControlledTypeScriptSystem,
  createProgram?: ts.CreateProgram<TProgram>,
  reportDiagnostic?: ts.DiagnosticReporter,
  reportWatchStatus?: ts.WatchStatusReporter,
  afterProgramCreate?: (program: TProgram) => void,
  hostExtensions: TypeScriptHostExtension[] = []
): ts.WatchCompilerHostOfFilesAndCompilerOptions<TProgram> {
  const baseWatchCompilerHost = typescript.createWatchCompilerHost(
    parsedCommandLine.fileNames,
    parsedCommandLine.options,
    system,
    createProgram,
    reportDiagnostic,
    reportWatchStatus,
    parsedCommandLine.projectReferences
  );

  let controlledWatchCompilerHost: ts.WatchCompilerHostOfFilesAndCompilerOptions<TProgram> = {
    ...baseWatchCompilerHost,
    createProgram(
      rootNames: ReadonlyArray<string> | undefined,
      options: ts.CompilerOptions | undefined,
      compilerHost?: ts.CompilerHost,
      oldProgram?: TProgram,
      configFileParsingDiagnostics?: ReadonlyArray<ts.Diagnostic>,
      projectReferences?: ReadonlyArray<ts.ProjectReference> | undefined
    ): TProgram {
      hostExtensions.forEach((hostExtension) => {
        if (compilerHost && hostExtension.extendCompilerHost) {
          compilerHost = hostExtension.extendCompilerHost(compilerHost, parsedCommandLine);
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
        ts.WatchCompilerHostOfFilesAndCompilerOptions<TProgram>
      >(controlledWatchCompilerHost, parsedCommandLine);
    }
  });

  return controlledWatchCompilerHost;
}

export { createControlledWatchCompilerHost };
