import { Issue } from './issue';

interface ForkTsCheckerWebpackPluginState {
  report: Promise<Issue[]>;
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
