import type { FilesChange } from '../../files-change';
import type { Issue } from '../../issue';
import { exposeRpc } from '../../rpc';

import { closeApi, closeApiOnExit } from './lib/api';
import {
  didConfigFileChanged,
  didDependenciesProbablyChanged,
  didRootFilesChanged,
  getParseConfigIssues,
  getParsedConfig,
  invalidateConfig,
} from './lib/config';
import { getDependencies, invalidateDependencies } from './lib/dependencies';
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

const getIssuesWorker = async (change: FilesChange): Promise<Issue[]> => {
  if (didConfigFileChanged(change)) {
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

  try {
    // use proper implementation based on the config
    if (config.build) {
      useSolutionBuilder();
    } else {
      useProgram(change);
    }
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
  const issues = getIssues();

  printPerformanceMeasuresIfNeeded();

  return issues;
};

exposeRpc(getIssuesWorker);
export type GetIssuesWorker = typeof getIssuesWorker;
