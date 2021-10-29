import type * as ts from 'typescript';

import type { TypeScriptHostExtension } from '../extension/TypeScriptExtension';

import type { ControlledTypeScriptSystem } from './ControlledTypeScriptSystem';
import { createControlledWatchCompilerHost } from './ControlledWatchCompilerHost';

function createControlledWatchSolutionBuilderHost<TProgram extends ts.BuilderProgram>(
  typescript: typeof ts,
  parsedCommandLine: ts.ParsedCommandLine,
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
    typescript,
    parsedCommandLine,
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
    getParsedCommandLine(fileName: string): ts.ParsedCommandLine | undefined {
      return typescript.getParsedCommandLineOfConfigFile(
        fileName,
        { skipLibCheck: true },
        {
          ...system,
          onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
            if (reportDiagnostic) {
              reportDiagnostic(diagnostic);
            }
          },
        }
      );
    },
  };

  hostExtensions.forEach((hostExtension) => {
    if (hostExtension.extendWatchSolutionBuilderHost) {
      controlledWatchSolutionBuilderHost = hostExtension.extendWatchSolutionBuilderHost<
        TProgram,
        ts.SolutionBuilderWithWatchHost<TProgram>
      >(controlledWatchSolutionBuilderHost, parsedCommandLine);
    }
  });

  return controlledWatchSolutionBuilderHost;
}

export { createControlledWatchSolutionBuilderHost };
