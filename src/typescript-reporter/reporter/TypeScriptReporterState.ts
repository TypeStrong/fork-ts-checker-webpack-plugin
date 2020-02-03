import * as ts from 'typescript';
import { ControlledWatchCompilerHost } from './ControlledWatchCompilerHost';
import { ControlledWatchSolutionBuilderHost } from './ControlledWatchSolutionBuilderHost';

/**
 * Contains all information that are passed between `run` calls
 */
interface TypeScriptReporterState {
  watchCompilerHost?: ControlledWatchCompilerHost<ts.SemanticDiagnosticsBuilderProgram>;
  watchSolutionBuilderHost?: ControlledWatchSolutionBuilderHost<
    ts.SemanticDiagnosticsBuilderProgram
  >;
  watchProgram?: ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>;
  solutionBuilder?: ts.SolutionBuilder<ts.SemanticDiagnosticsBuilderProgram>;
  diagnosticsPreProject: Record<string, ts.Diagnostic[]>;
}

function createTypeScriptReporterState(): TypeScriptReporterState {
  return {
    watchCompilerHost: undefined,
    watchSolutionBuilderHost: undefined,
    watchProgram: undefined,
    solutionBuilder: undefined,
    diagnosticsPreProject: {},
  };
}

export { TypeScriptReporterState, createTypeScriptReporterState };
