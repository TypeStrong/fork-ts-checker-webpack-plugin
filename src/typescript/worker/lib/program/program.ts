import type * as ts from 'typescript';

import { getConfigFilePathFromProgram, getParsedConfig } from '../config';
import { updateDiagnostics, getDiagnosticsOfProgram } from '../diagnostics';
import { createCompilerHost } from '../host/compiler-host';
import { typescript } from '../typescript';

let compilerHost: ts.CompilerHost | undefined;
let program: ts.Program | undefined;

export function useProgram() {
  const parsedConfig = getParsedConfig();

  if (!compilerHost) {
    compilerHost = createCompilerHost(parsedConfig);
  }
  if (!program) {
    program = typescript.createProgram({
      rootNames: parsedConfig.fileNames,
      options: parsedConfig.options,
      projectReferences: parsedConfig.projectReferences,
      host: compilerHost,
    });
  }

  updateDiagnostics(getConfigFilePathFromProgram(program), getDiagnosticsOfProgram(program));
}

export function invalidateProgram(withHost = false) {
  if (withHost) {
    compilerHost = undefined;
  }
  program = undefined;
}
