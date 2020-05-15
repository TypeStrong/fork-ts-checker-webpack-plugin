import * as ts from 'typescript';
import { createControlledWatchCompilerHost } from './ControlledWatchCompilerHost';
import { TypeScriptHostExtension } from '../extension/TypeScriptExtension';
import { ControlledTypeScriptSystem } from './ControlledTypeScriptSystem';

function createControlledWatchSolutionBuilderHost<TProgram extends ts.BuilderProgram>(
  configFileName: string,
  optionsToExtend: ts.CompilerOptions | undefined,
  system: ControlledTypeScriptSystem,
  createProgram?: ts.CreateProgram<TProgram>,
  reportDiagnostic?: ts.DiagnosticReporter,
  reportWatchStatus?: ts.WatchStatusReporter,
  reportSolutionBuilderStatus?: (diagnostic: ts.Diagnostic) => void,
  afterProgramCreate?: (program: TProgram) => void,
  afterProgramEmitAndDiagnostics?: (program: TProgram) => void,
  hostExtensions: TypeScriptHostExtension[] = []
): ts.SolutionBuilderWithWatchHost<TProgram> {
  const controlledWatchCompilerHost = createControlledWatchCompilerHost(
    configFileName,
    optionsToExtend,
    system,
    createProgram,
    reportDiagnostic,
    reportWatchStatus,
    afterProgramCreate,
    hostExtensions
  );

  let controlledWatchSolutionBuilderHost: ts.SolutionBuilderWithWatchHost<TProgram> = {
    ...controlledWatchCompilerHost,
    reportDiagnostic(diagnostic: ts.Diagnostic): void {
      if (reportDiagnostic) {
        reportDiagnostic(diagnostic);
      }
    },
    reportSolutionBuilderStatus(diagnostic: ts.Diagnostic): void {
      if (reportSolutionBuilderStatus) {
        reportSolutionBuilderStatus(diagnostic);
      }
    },
    afterProgramEmitAndDiagnostics(program): void {
      if (afterProgramEmitAndDiagnostics) {
        afterProgramEmitAndDiagnostics(program);
      }
    },
    createDirectory(path: string): void {
      system.createDirectory(path);
    },
    writeFile(path: string, data: string): void {
      system.writeFile(path, data);
    },
    getModifiedTime(fileName: string): Date | undefined {
      return system.getModifiedTime(fileName);
    },
    setModifiedTime(fileName: string, date: Date): void {
      system.setModifiedTime(fileName, date);
    },
    deleteFile(fileName: string): void {
      system.deleteFile(fileName);
    },
  };

  const parsedCommendLine = ts.getParsedCommandLineOfConfigFile(
    configFileName,
    optionsToExtend || {},
    {
      fileExists: controlledWatchCompilerHost.fileExists,
      readFile: controlledWatchCompilerHost.readFile,
      readDirectory: controlledWatchCompilerHost.readDirectory,
      useCaseSensitiveFileNames: controlledWatchCompilerHost.useCaseSensitiveFileNames(),
      getCurrentDirectory: controlledWatchCompilerHost.getCurrentDirectory,
      trace: controlledWatchCompilerHost.trace,
      // it's already registered in the controlledWatchCompilerHost
      onUnRecoverableConfigFileDiagnostic: () => null,
    }
  );

  hostExtensions.forEach((hostExtension) => {
    if (hostExtension.extendWatchSolutionBuilderHost) {
      controlledWatchSolutionBuilderHost = hostExtension.extendWatchSolutionBuilderHost<
        TProgram,
        ts.SolutionBuilderWithWatchHost<TProgram>
      >(controlledWatchSolutionBuilderHost, parsedCommendLine);
    }
  });

  return controlledWatchSolutionBuilderHost;
}

export { createControlledWatchSolutionBuilderHost };
