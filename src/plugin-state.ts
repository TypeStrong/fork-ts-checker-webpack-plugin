import type { FullTap } from 'tapable';

import type { FilesMatch } from './files-match';
import type { Issue } from './issue';

interface ForkTsCheckerWebpackPluginState {
  issuesPromise: Promise<Issue[] | undefined>;
  dependenciesPromise: Promise<FilesMatch | undefined>;
  lastDependencies: FilesMatch | undefined;
  watching: boolean;
  initialized: boolean;
  iteration: number;
  webpackDevServerDoneTap: FullTap | undefined;
}

function createPluginState(): ForkTsCheckerWebpackPluginState {
  return {
    issuesPromise: Promise.resolve(undefined),
    dependenciesPromise: Promise.resolve(undefined),
    lastDependencies: undefined,
    watching: false,
    initialized: false,
    iteration: 0,
    webpackDevServerDoneTap: undefined,
  };
}

export { ForkTsCheckerWebpackPluginState, createPluginState };
