import type * as ts from 'typescript';

import { getConfigFilePathFromProgram, getParsedConfig } from '../config';
import { updateDiagnostics, getDiagnosticsOfProgram } from '../diagnostics';
import { emitDtsIfNeeded } from '../emit';
import { createCompilerHost } from '../host/compiler-host';
import { startTracingIfNeeded, stopTracingIfNeeded } from '../tracing';
import { typescript } from '../typescript';

let compilerHost: ts.CompilerHost | undefined;
let program: ts.Program | undefined;

export function useProgram() {
  const parsedConfig = getParsedConfig();

  if (!compilerHost) {
    compilerHost = createCompilerHost(parsedConfig);
  }
  if (!program) {
    startTracingIfNeeded(parsedConfig.options);
    program = typescript.createProgram({
      rootNames: parsedConfig.fileNames,
      options: parsedConfig.options,
      projectReferences: parsedConfig.projectReferences,
      host: compilerHost,
    });
  }

  updateDiagnostics(getConfigFilePathFromProgram(program), getDiagnosticsOfProgram(program));
  emitDtsIfNeeded(program);
  stopTracingIfNeeded(program);
}

export function invalidateProgram(withHost = false) {
  if (withHost) {
    compilerHost = undefined;
  }
  program = undefined;
}
