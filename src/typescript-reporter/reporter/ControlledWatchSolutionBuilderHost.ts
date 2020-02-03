import * as ts from 'typescript';
import fs from 'graceful-fs';
import { createControlledWatchCompilerHost } from './ControlledWatchCompilerHost';
import { ControlledWatchHost } from './ControlledWatchHost';
import { TypeScriptHostExtension } from '../extension/TypeScriptExtension';

interface ControlledWatchSolutionBuilderHost<TProgram extends ts.BuilderProgram>
  extends ts.SolutionBuilderWithWatchHost<TProgram>,
    ControlledWatchHost {}

function createControlledWatchSolutionBuilderHost<TProgram extends ts.BuilderProgram>(
  configFileName: string,
  optionsToExtend: ts.CompilerOptions | undefined,
  system: ts.System,
  createProgram?: ts.CreateProgram<TProgram>,
  reportDiagnostic?: ts.DiagnosticReporter,
  reportWatchStatus?: ts.WatchStatusReporter,
  reportSolutionBuilderStatus?: (diagnostic: ts.Diagnostic) => void,
  afterProgramCreate?: (program: TProgram) => void,
  afterProgramEmitAndDiagnostics?: (program: TProgram) => void,
  hostExtensions: TypeScriptHostExtension[] = []
): ControlledWatchSolutionBuilderHost<TProgram> {
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

  let controlledWatchSolutionBuilderHost: ControlledWatchSolutionBuilderHost<TProgram> = {
    ...controlledWatchCompilerHost,
    writeFile(path: string, data: string, writeByteOrderMark?: boolean): void {
      // return ts.sys.writeFile(fileName, data, writeByteOrderMark);
    },
    deleteFile(path: string): void {
      // if (ts.sys.deleteFile) {
      //   ts.sys.deleteFile(fileName);
      // } else {
      //   fs.unlinkSync(fileName);
      // }
    },
    createDirectory(path: string): void {
      // do nothing
    },
    getModifiedTime(fileName: string): Date | undefined {
      if (ts.sys.getModifiedTime) {
        return ts.sys.getModifiedTime(fileName);
      } else {
        return fs.statSync(fileName).mtime;
      }
    },
    setModifiedTime(path: string, date: Date): void {
      // if (ts.sys.setModifiedTime) {
      //   ts.sys.setModifiedTime(fileName, date);
      // } else {
      //   fs.utimesSync(fileName, date, date);
      // }
    },
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
      // it's already registered in the watchCompilerHost
      onUnRecoverableConfigFileDiagnostic: () => null,
    }
  );

  hostExtensions.forEach((hostExtension) => {
    if (hostExtension.extendWatchSolutionBuilderHost) {
      controlledWatchSolutionBuilderHost = hostExtension.extendWatchSolutionBuilderHost<
        TProgram,
        ControlledWatchSolutionBuilderHost<TProgram>
      >(controlledWatchSolutionBuilderHost, parsedCommendLine);
    }
  });

  return controlledWatchSolutionBuilderHost;
}

export { ControlledWatchSolutionBuilderHost, createControlledWatchSolutionBuilderHost };
