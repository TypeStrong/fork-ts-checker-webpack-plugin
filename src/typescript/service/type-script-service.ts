import type { Diagnostic } from 'typescript/async';

import type { FilesChange } from '../../files-change';
import type { FilesMatch } from '../../files-match';
import type { Issue } from '../../issue';
import { AbortError } from '../../utils/async/abort-error';
import type { TypeScriptWorkerConfig } from '../type-script-worker-config';

import { createApiHost } from './api';
import { createConfigStore, didConfigFileChanged, didDependenciesProbablyChanged } from './config';
import { createDependenciesStore } from './dependencies';
import { createCrashDiagnostic, createIssuesFromDiagnostics } from './diagnostics';
import { printPerformanceMeasuresIfNeeded, resetPerformanceIfNeeded } from './performance';
import { createProgramHost } from './program';
import { createSolutionBuilderHost } from './solution-builder';
import type { TypeScriptModules } from './typescript';
import { loadTypeScript } from './typescript';

export interface TypeScriptService {
  /** Type-checks the project and returns its issues. */
  getIssues(change: FilesChange): Promise<Issue[]>;
  /** Computes the files and directories webpack should watch. */
  getDependencies(change: FilesChange): Promise<FilesMatch>;
  /**
   * Stops the native compiler processes, which would otherwise keep the Node.js
   * process alive. The service starts them again on the next call.
   */
  close(): Promise<void>;
}

/**
 * Runs the tasks one at a time. The compiler calls are asynchronous, so without
 * it a second call could change the state that the first one is still using.
 */
function createQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.catch(() => undefined);

    return result;
  };
}

/**
 * Type checking: a program, or the build orchestrator with the `build` option.
 * Any error resets the program, the orchestrator and the API, so a dead compiler
 * process recovers on the next run.
 */
function createIssuesChecker(config: TypeScriptWorkerConfig, typescript: TypeScriptModules) {
  const apiHost = createApiHost(config, typescript, { interceptBuildOutputs: true });
  const configStore = createConfigStore(config, apiHost);
  const dependenciesStore = createDependenciesStore(config, apiHost, configStore);
  const programHost = createProgramHost(config, typescript, apiHost, configStore);
  const solutionBuilderHost = createSolutionBuilderHost(config, apiHost);
  const enqueue = createQueue();
  let diagnostics: Diagnostic[] = [];
  // counts the resets, to tell a failure caused by closing the service from a crash
  let generation = 0;

  async function reset() {
    generation++;
    programHost.resetProgram();
    solutionBuilderHost.resetSolutionBuilder();
    configStore.invalidateConfig();
    dependenciesStore.invalidateDependencies();
    diagnostics = [];
    await apiHost.closeApi();
  }

  async function getIssues(change: FilesChange): Promise<Issue[]> {
    const startGeneration = generation;

    try {
      if (didConfigFileChanged(change, await dependenciesStore.getConfigFiles())) {
        configStore.invalidateConfig();
        dependenciesStore.invalidateDependencies();
        diagnostics = [];

        programHost.invalidateProgram();
        await solutionBuilderHost.invalidateSolutionBuilder();
      } else if (
        didDependenciesProbablyChanged(await dependenciesStore.getDependencies(), change)
      ) {
        const previousRootFiles = (await configStore.getParsedConfig()).fileNames;
        configStore.invalidateConfig();
        dependenciesStore.invalidateDependencies();

        if (await configStore.didRootFilesChanged(previousRootFiles)) {
          programHost.invalidateProgramRootFileNames();
        }
      }

      await resetPerformanceIfNeeded(config, apiHost);

      const parseConfigIssues = configStore.getParseConfigIssues();
      if (parseConfigIssues.length) {
        // the program never sees this run's file changes, so it has to start afresh
        // once the config can be parsed again
        programHost.invalidateProgram();

        // report config parse issues and exit
        return parseConfigIssues;
      }

      // use proper implementation based on the config
      diagnostics = config.build
        ? await solutionBuilderHost.useSolutionBuilder()
        : await programHost.useProgram(change);

      // the timings come from the compiler process too
      await printPerformanceMeasuresIfNeeded(config, apiHost);
    } catch (error) {
      if (generation !== startGeneration) {
        // the service was closed during the check
        throw new AbortError();
      }
      // the compiler process may have died - start from scratch on the next run
      await reset();

      return createIssuesFromDiagnostics([createCrashDiagnostic(error)]);
    }

    return createIssuesFromDiagnostics(diagnostics);
  }

  return {
    getIssues: (change: FilesChange) => enqueue(() => getIssues(change)),
    close: reset,
  };
}

/**
 * Works out what webpack should watch. It has its own native compiler process,
 * so it isn't held up by a type check, and its own parsed config, as it sees
 * the file changes at a different time than the issues checker.
 */
function createDependenciesResolver(config: TypeScriptWorkerConfig, typescript: TypeScriptModules) {
  const apiHost = createApiHost(config, typescript, { interceptBuildOutputs: false });
  const configStore = createConfigStore(config, apiHost);
  const dependenciesStore = createDependenciesStore(config, apiHost, configStore);
  const enqueue = createQueue();
  let generation = 0;

  async function reset() {
    generation++;
    configStore.invalidateConfig();
    dependenciesStore.invalidateDependencies();
    await apiHost.closeApi();
  }

  async function getDependencies(change: FilesChange): Promise<FilesMatch> {
    const startGeneration = generation;

    try {
      if (
        didConfigFileChanged(change, await dependenciesStore.getConfigFiles()) ||
        didDependenciesProbablyChanged(await dependenciesStore.getDependencies(), change)
      ) {
        configStore.invalidateConfig();
        dependenciesStore.invalidateDependencies();
      }

      return await dependenciesStore.getDependencies();
    } catch (error) {
      if (generation !== startGeneration) {
        // the service was closed during the call
        throw new AbortError();
      }
      // the compiler process may have died - start from scratch on the next call
      await reset();

      throw error;
    }
  }

  return {
    getDependencies: (change: FilesChange) => enqueue(() => getDependencies(change)),
    close: reset,
  };
}

/**
 * Talks to TypeScript's native compiler from the webpack process, through the
 * asynchronous API. The compiler does the work in its own processes, so webpack
 * isn't blocked while it runs.
 */
export function createTypeScriptService(config: TypeScriptWorkerConfig): TypeScriptService {
  let parts:
    | {
        issuesChecker: ReturnType<typeof createIssuesChecker>;
        dependenciesResolver: ReturnType<typeof createDependenciesResolver>;
      }
    | undefined;

  // TypeScript is loaded on first use, like the compiler processes
  function getParts() {
    if (!parts) {
      const typescript = loadTypeScript(config.typescriptPath);
      parts = {
        issuesChecker: createIssuesChecker(config, typescript),
        dependenciesResolver: createDependenciesResolver(config, typescript),
      };
    }

    return parts;
  }

  return {
    getIssues: async (change) => getParts().issuesChecker.getIssues(change),
    getDependencies: async (change) => getParts().dependenciesResolver.getDependencies(change),
    close: async () => {
      if (parts) {
        await Promise.all([parts.issuesChecker.close(), parts.dependenciesResolver.close()]);
      }
    },
  };
}
