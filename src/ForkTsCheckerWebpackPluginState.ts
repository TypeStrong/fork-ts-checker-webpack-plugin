import { Report } from './reporter';

interface ForkTsCheckerWebpackPluginState {
  report: Promise<Report | undefined>;
  removedFiles: string[];
  isWatching: boolean;
}

function createForkTsCheckerWebpackPluginState(): ForkTsCheckerWebpackPluginState {
  return {
    report: Promise.resolve([]),
    removedFiles: [],
    isWatching: false,
  };
}

export { ForkTsCheckerWebpackPluginState, createForkTsCheckerWebpackPluginState };
