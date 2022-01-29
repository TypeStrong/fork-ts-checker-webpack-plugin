import type { FilesChange } from '../../files-change';
import type { Issue } from '../../issue';
import { exposeRpc } from '../../rpc';

import { invalidateArtifacts, registerArtifacts } from './lib/artifacts';
import {
  didConfigFileChanged,
  didRootFilesChanged,
  getParseConfigIssues,
  invalidateConfig,
} from './lib/config';
import { invalidateDependencies } from './lib/dependencies';
import { getIssues, invalidateDiagnostics } from './lib/diagnostics';
import {
  disablePerformanceIfNeeded,
  enablePerformanceIfNeeded,
  printPerformanceMeasuresIfNeeded,
} from './lib/performance';
import { invalidateProgram, useProgram } from './lib/program/program';
import { invalidateSolutionBuilder, useSolutionBuilder } from './lib/program/solution-builder';
import {
  invalidateWatchProgram,
  invalidateWatchProgramRootFileNames,
  useWatchProgram,
} from './lib/program/watch-program';
import { system } from './lib/system';
import { dumpTracingLegendIfNeeded } from './lib/tracing';
import { invalidateTsBuildInfo } from './lib/tsbuildinfo';
import { config } from './lib/worker-config';

const getIssuesWorker = async (
  { changedFiles = [], deletedFiles = [] }: FilesChange,
  watching: boolean
): Promise<Issue[]> => {
  system.invalidateCache();
  invalidateDependencies();

  if (didConfigFileChanged({ changedFiles, deletedFiles })) {
    invalidateConfig();
    invalidateArtifacts();
    invalidateDiagnostics();

    invalidateProgram(true);
    invalidateWatchProgram(true);
    invalidateSolutionBuilder(true);

    invalidateTsBuildInfo();
  } else if (didRootFilesChanged()) {
    invalidateArtifacts();

    invalidateWatchProgramRootFileNames();
    invalidateSolutionBuilder();
  }

  registerArtifacts();
  enablePerformanceIfNeeded();

  const parseConfigIssues = getParseConfigIssues();
  if (parseConfigIssues.length) {
    // report config parse issues and exit
    return parseConfigIssues;
  }

  // use proper implementation based on the config
  if (config.build) {
    useSolutionBuilder();
  } else if (watching) {
    useWatchProgram();
  } else {
    useProgram();
  }

  // simulate file system events
  changedFiles.forEach((changedFile) => {
    system?.invokeFileChanged(changedFile);
  });
  deletedFiles.forEach((removedFile) => {
    system?.invokeFileDeleted(removedFile);
  });

  // wait for all queued events to be processed
  await system.waitForQueued();

  // retrieve all collected diagnostics as normalized issues
  const issues = getIssues();

  dumpTracingLegendIfNeeded();
  printPerformanceMeasuresIfNeeded();
  disablePerformanceIfNeeded();

  return issues;
};

exposeRpc(getIssuesWorker);
export type GetIssuesWorker = typeof getIssuesWorker;
