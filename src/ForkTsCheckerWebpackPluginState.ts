import { Report } from './reporter';

interface ForkTsCheckerWebpackPluginState {
  report: Promise<Report | undefined>;
  changedFiles: string[];
  removedFiles: string[];
  isWatching: boolean;
}

function createForkTsCheckerWebpackPluginState(): ForkTsCheckerWebpackPluginState {
  return {
    report: Promise.resolve([]),
    changedFiles: [],
    removedFiles: [],
    isWatching: false,
  };
}

export { ForkTsCheckerWebpackPluginState, createForkTsCheckerWebpackPluginState };
