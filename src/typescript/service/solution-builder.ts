import type { BuildOrchestrator, Diagnostic, OverrideCompilerOptions } from 'typescript/async';

import type { TypeScriptWorkerConfig } from '../type-script-worker-config';

import type { ApiHost } from './api';
import { getSharedImplicitCompilerOptions } from './config';

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

export interface SolutionBuilderHost {
  /** Builds the projects that changed and returns the diagnostics of all of them. */
  useSolutionBuilder(): Promise<Diagnostic[]>;
  invalidateSolutionBuilder(): Promise<void>;
  /** Forgets the orchestrator without talking to the compiler, which may be gone. */
  resetSolutionBuilder(): void;
}

export function createSolutionBuilderHost(
  config: TypeScriptWorkerConfig,
  { createBuildOrchestrator, clearRealDirectories }: ApiHost
): SolutionBuilderHost {
  /**
   * The build orchestrator reads each project's tsconfig.json from disk and only
   * accepts this small set of overrides, so the rest of `configOverwrite` can't apply.
   */
  function getOverrideCompilerOptions(): OverrideCompilerOptions {
    const userCompilerOptions = config.configOverwrite?.compilerOptions || {};
    const overrides: OverrideCompilerOptions = getSharedImplicitCompilerOptions(config);
    for (const option of OVERRIDABLE_COMPILER_OPTIONS) {
      if (option in userCompilerOptions) {
        overrides[option] = userCompilerOptions[option];
      }
    }

    return overrides;
  }

  let solutionBuilder: BuildOrchestrator | undefined;

  async function useSolutionBuilder(): Promise<Diagnostic[]> {
    if (!solutionBuilder) {
      solutionBuilder = await createBuildOrchestrator([config.configFile], {
        cwd: config.context,
        overrideCompilerOptions: getOverrideCompilerOptions(),
      });
    }

    // the orchestrator checks the file system for changes itself, but a
    // `yarn install` can relink workspace packages between builds
    clearRealDirectories();
    const result = await solutionBuilder.build();

    return [...(result.diagnostics || [])];
  }

  async function invalidateSolutionBuilder() {
    const previousSolutionBuilder = solutionBuilder;
    solutionBuilder = undefined;
    await previousSolutionBuilder?.dispose();
  }

  function resetSolutionBuilder() {
    solutionBuilder = undefined;
  }

  return { useSolutionBuilder, invalidateSolutionBuilder, resetSolutionBuilder };
}
