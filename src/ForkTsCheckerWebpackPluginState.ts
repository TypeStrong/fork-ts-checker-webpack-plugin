import { FullTap } from 'tapable';
import { FilesMatch, Report } from './reporter';
import { Issue } from './issue';

interface ForkTsCheckerWebpackPluginState {
  issuesReportPromise: Promise<Report | undefined>;
  dependenciesReportPromise: Promise<Report | undefined>;
  issuesPromise: Promise<Issue[] | undefined>;
  dependenciesPromise: Promise<FilesMatch | undefined>;
  lastDependencies: FilesMatch | undefined;
  watching: boolean;
  initialized: boolean;
  webpackDevServerDoneTap: FullTap | undefined;
}

function createForkTsCheckerWebpackPluginState(): ForkTsCheckerWebpackPluginState {
  return {
    issuesReportPromise: Promise.resolve(undefined),
    dependenciesReportPromise: Promise.resolve(undefined),
    issuesPromise: Promise.resolve(undefined),
    dependenciesPromise: Promise.resolve(undefined),
    lastDependencies: undefined,
    watching: false,
    initialized: false,
    webpackDevServerDoneTap: undefined,
  };
}

export { ForkTsCheckerWebpackPluginState, createForkTsCheckerWebpackPluginState };
