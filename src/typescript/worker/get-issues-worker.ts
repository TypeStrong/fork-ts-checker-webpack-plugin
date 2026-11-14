import type { FilesChange } from '../../files-change';
import type { Issue } from '../../issue';
import { exposeRpc } from '../../rpc';

import { closeApi, closeApiOnExit, interceptBuildOutputs } from './lib/api';
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

closeApiOnExit();
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
