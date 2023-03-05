import type * as ts from 'typescript';

import { system } from '../system';
import { typescript } from '../typescript';

import { createWatchCompilerHost } from './watch-compiler-host';

export function createWatchSolutionBuilderHost<TProgram extends ts.BuilderProgram>(
  parsedConfig: ts.ParsedCommandLine,
  createProgram?: ts.CreateProgram<TProgram>,
  reportDiagnostic?: ts.DiagnosticReporter,
  reportWatchStatus?: ts.WatchStatusReporter,
  reportSolutionBuilderStatus?: (diagnostic: ts.Diagnostic) => void,
  afterProgramCreate?: (program: TProgram) => void,
  afterProgramEmitAndDiagnostics?: (program: TProgram) => void
): ts.SolutionBuilderWithWatchHost<TProgram> {
  const controlledWatchCompilerHost = createWatchCompilerHost(
    parsedConfig,
    createProgram,
    reportDiagnostic,
    reportWatchStatus,
    afterProgramCreate
  );

  return {
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
}
