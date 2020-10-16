import { Tap } from 'tapable';
import { Dependencies, Report } from './reporter';
import { Issue } from './issue';

interface ForkTsCheckerWebpackPluginState {
  reportPromise: Promise<Report | undefined>;
  issuesPromise: Promise<Issue[] | undefined>;
  dependenciesPromise: Promise<Dependencies | undefined>;
  lastDependencies: Dependencies | undefined;
  watching: boolean;
  initialized: boolean;
  webpackDevServerDoneTap: Tap | undefined;
}

function createForkTsCheckerWebpackPluginState(): ForkTsCheckerWebpackPluginState {
  return {
    reportPromise: Promise.resolve(undefined),
    issuesPromise: Promise.resolve(undefined),
    dependenciesPromise: Promise.resolve(undefined),
    lastDependencies: undefined,
    watching: false,
    initialized: false,
    webpackDevServerDoneTap: undefined,
  };
}

export { ForkTsCheckerWebpackPluginState, createForkTsCheckerWebpackPluginState };
