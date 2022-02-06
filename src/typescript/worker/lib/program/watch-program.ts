import type * as ts from 'typescript';

import { getConfigFilePathFromBuilderProgram, getParsedConfig } from '../config';
import { getDependencies } from '../dependencies';
import { updateDiagnostics, getDiagnosticsOfProgram } from '../diagnostics';
import { emitDtsIfNeeded } from '../emit';
import { createWatchCompilerHost } from '../host/watch-compiler-host';
import { startTracingIfNeeded, stopTracingIfNeeded } from '../tracing';
import { emitTsBuildInfoIfNeeded } from '../tsbuildinfo';
import { typescript } from '../typescript';

let watchCompilerHost:
  | ts.WatchCompilerHostOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram>
  | undefined;
let watchProgram:
  | ts.WatchOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram>
  | undefined;
let shouldUpdateRootFiles = false;

export function useWatchProgram() {
  if (!watchCompilerHost) {
    const parsedConfig = getParsedConfig();

    watchCompilerHost = createWatchCompilerHost(
      parsedConfig,
      (
        rootNames,
        compilerOptions,
        host,
        oldProgram,
        configFileParsingDiagnostics,
        projectReferences
      ) => {
        if (compilerOptions) {
          startTracingIfNeeded(compilerOptions);
        }
        return typescript.createSemanticDiagnosticsBuilderProgram(
          rootNames,
          compilerOptions,
          host,
          oldProgram,
          configFileParsingDiagnostics,
          projectReferences
        );
      },
      undefined,
      undefined,
      (builderProgram) => {
        updateDiagnostics(
          getConfigFilePathFromBuilderProgram(builderProgram),
          getDiagnosticsOfProgram(builderProgram)
        );
        emitDtsIfNeeded(builderProgram);
        emitTsBuildInfoIfNeeded(builderProgram);
        stopTracingIfNeeded(builderProgram);
      }
    );
    watchProgram = undefined;
  }
  if (!watchProgram) {
    watchProgram = typescript.createWatchProgram(watchCompilerHost);
  }

  if (shouldUpdateRootFiles) {
    // we have to update root files manually as don't use config file as a program input
    watchProgram.updateRootFileNames(getDependencies().files);
    shouldUpdateRootFiles = false;
  }
}

export function invalidateWatchProgram(withHost = false) {
  if (withHost) {
    watchCompilerHost = undefined;
  }
  watchProgram = undefined;
}

export function invalidateWatchProgramRootFileNames() {
  shouldUpdateRootFiles = true;
}
