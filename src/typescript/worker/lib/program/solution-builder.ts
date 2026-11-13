import type { BuildOrchestrator, OverrideCompilerOptions } from 'typescript/sync';

import { createBuildOrchestrator } from '../api';
import { updateDiagnostics } from '../diagnostics';
import { config } from '../worker-config';

const OVERRIDABLE_COMPILER_OPTIONS: (keyof OverrideCompilerOptions)[] = [
  'incremental',
  'assumeChangesOnlyAffectDirectDependencies',
  'declaration',
  'declarationMap',
  'emitDeclarationOnly',
  'sourceMap',
  'inlineSourceMap',
  'traceResolution',
];

/**
 * The build orchestrator reads each project's tsconfig.json from disk and only
 * accepts this small set of overrides, so the rest of `configOverwrite` can't apply.
 */
function getOverrideCompilerOptions(): OverrideCompilerOptions {
  const userCompilerOptions = config.configOverwrite?.compilerOptions || {};
  const overrides: OverrideCompilerOptions = {
    sourceMap: false,
    inlineSourceMap: false,
  };
  if (config.mode === 'write-dts') {
    overrides.declaration = true;
  }
  for (const option of OVERRIDABLE_COMPILER_OPTIONS) {
    if (option in userCompilerOptions) {
      overrides[option] = userCompilerOptions[option];
    }
  }

  return overrides;
}

let solutionBuilder: BuildOrchestrator | undefined;

export function useSolutionBuilder() {
  if (!solutionBuilder) {
    solutionBuilder = createBuildOrchestrator([config.configFile], {
      cwd: config.context,
      overrideCompilerOptions: getOverrideCompilerOptions(),
    });
  }

  // the orchestrator checks the file system for changes itself
  const result = solutionBuilder.build();
  updateDiagnostics(config.configFile, result.diagnostics || []);
}

export function invalidateSolutionBuilder() {
  solutionBuilder?.dispose();
  solutionBuilder = undefined;
}

/** Forgets the orchestrator without talking to the compiler, which may be gone. */
export function resetSolutionBuilder() {
  solutionBuilder = undefined;
}
