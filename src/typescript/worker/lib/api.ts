import type { API, BuildOrchestrator, BuildOrchestratorOptions } from 'typescript/sync';

import { createInMemoryFileSystem } from './in-memory-file-system';
import { typescriptSync } from './typescript';
import { config } from './worker-config';

// `API#createBuildOrchestrator` exists at runtime (it backs `tsc --build`),
// but isn't declared in the 7.1 typings yet.
type CreateBuildOrchestrator = (
  rootNames: readonly string[],
  options?: BuildOrchestratorOptions
) => BuildOrchestrator;

let api: API | undefined;
let invalidateRealDirectoriesOfApi: (() => void) | undefined;
let interceptsBuildOutputs = false;

/**
 * Makes the API keep build-mode outputs in memory in the `in-memory` mode. Only
 * the worker that builds needs it: the callbacks are round trips from the native
 * compiler, which a worker that only parses tsconfig files would pay for nothing.
 * Call it before the first `getApi()`.
 */
export function interceptBuildOutputs() {
  interceptsBuildOutputs = true;
}

/** Forgets the resolved symlinks, in case packages were relinked between builds. */
export function invalidateRealDirectories() {
  invalidateRealDirectoriesOfApi?.();
}

export function getApi(): API {
  if (!api) {
    // only `build` lets TypeScript decide what to write, and the `write` mode lets it;
    // the outputs live in the callbacks' closure, so they go with the API
    const fileSystem =
      interceptsBuildOutputs && config.build && config.mode === 'in-memory'
        ? createInMemoryFileSystem()
        : undefined;
    invalidateRealDirectoriesOfApi = fileSystem?.invalidateRealDirectories;
    api = new typescriptSync.API({
      cwd: config.context,
      fs: fileSystem?.callbacks,
      collectTiming: config.profile,
    });
  }

  return api;
}

export function createBuildOrchestrator(
  rootNames: readonly string[],
  options: BuildOrchestratorOptions
): BuildOrchestrator {
  const create = (getApi() as unknown as { createBuildOrchestrator?: CreateBuildOrchestrator })
    .createBuildOrchestrator;
  if (typeof create !== 'function') {
    throw new Error(
      'The installed TypeScript version does not support the `build` option (missing API#createBuildOrchestrator).'
    );
  }

  return create.call(api, rootNames, options);
}

export function closeApi() {
  invalidateRealDirectoriesOfApi = undefined;
  if (api) {
    try {
      api.close();
    } catch (error) {
      // the compiler process may already be gone
    }
    api = undefined;
  }
}
