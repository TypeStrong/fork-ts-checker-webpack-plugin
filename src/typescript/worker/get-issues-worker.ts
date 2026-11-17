import type { FilesChange } from '../../files-change';
import type { Issue } from '../../issue';
import { exposeRpc } from '../../rpc';

import { closeApi, interceptBuildOutputs } from './lib/api';
import {
  didConfigFileChanged,
  didDependenciesProbablyChanged,
  didRootFilesChanged,
  getParseConfigIssues,
  getParsedConfig,
  invalidateConfig,
} from './lib/config';
import { getConfigFiles, getDependencies, invalidateDependencies } from './lib/dependencies';
import {
  createCrashDiagnostic,
  createIssuesFromDiagnostics,
  getIssues,
  invalidateDiagnostics,
} from './lib/diagnostics';
import { printPerformanceMeasuresIfNeeded, resetPerformanceIfNeeded } from './lib/performance';
import {
  invalidateProgram,
  invalidateProgramRootFileNames,
  resetProgram,
  useProgram,
} from './lib/program/program';
import {
  invalidateSolutionBuilder,
  resetSolutionBuilder,
  useSolutionBuilder,
} from './lib/program/solution-builder';
import { config } from './lib/worker-config';

// The native compiler runs in its own process, which must not outlive the worker.
// Signals are deliberately left alone: the compiler exits by itself once the
// worker's end of the pipe closes, and a signal handler couldn't run while the
// worker is blocked in a synchronous compiler call, so the plugin's SIGTERM
// wouldn't stop a busy worker.
process.on('exit', closeApi);
interceptBuildOutputs();

const getIssuesWorker = async (change: FilesChange): Promise<Issue[]> => {
  try {
    if (didConfigFileChanged(change, getConfigFiles())) {
      invalidateConfig();
      invalidateDependencies();
      invalidateDiagnostics();

      invalidateProgram();
      invalidateSolutionBuilder();
    } else if (didDependenciesProbablyChanged(getDependencies(), change)) {
      const previousRootFiles = getParsedConfig().fileNames;
      invalidateConfig();
      invalidateDependencies();

      if (didRootFilesChanged(previousRootFiles)) {
        invalidateProgramRootFileNames();
      }
    }

    resetPerformanceIfNeeded();

    const parseConfigIssues = getParseConfigIssues();
    if (parseConfigIssues.length) {
      // the program never sees this run's file changes, so it has to start afresh
      // once the config can be parsed again
      invalidateProgram();

      // report config parse issues and exit
      return parseConfigIssues;
    }

    // use proper implementation based on the config
    if (config.build) {
      useSolutionBuilder();
    } else {
      useProgram(change);
    }

    // the timings come from the compiler process too
    printPerformanceMeasuresIfNeeded();
  } catch (error) {
    // the compiler process may have died - start from scratch on the next run
    resetProgram();
    resetSolutionBuilder();
    closeApi();
    invalidateConfig();
    invalidateDependencies();
    invalidateDiagnostics();

    return createIssuesFromDiagnostics([createCrashDiagnostic(error)]);
  }

  // retrieve all collected diagnostics as normalized issues
  return getIssues();
};

exposeRpc(getIssuesWorker);
export type GetIssuesWorker = typeof getIssuesWorker;
