import { Issue } from './issue';

interface ForkTsCheckerWebpackPluginState {
  report: Promise<Issue[]>;
  isWatching: boolean;
  createdFiles: string[];
  changedFiles: string[];
}

function createForkTsCheckerWebpackPluginState(): ForkTsCheckerWebpackPluginState {
  return {
    report: Promise.resolve([]),
    isWatching: false,
    createdFiles: [],
    changedFiles: [],
  };
}

export { ForkTsCheckerWebpackPluginState, createForkTsCheckerWebpackPluginState };
