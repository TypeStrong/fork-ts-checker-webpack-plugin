import { Report } from './reporter';

interface ForkTsCheckerWebpackPluginState {
  report: Promise<Report | undefined>;
  removedFiles: string[];
  watching: boolean;
  initialized: boolean;
}

function createForkTsCheckerWebpackPluginState(): ForkTsCheckerWebpackPluginState {
  return {
    report: Promise.resolve([]),
    removedFiles: [],
    watching: false,
    initialized: false,
  };
}

export { ForkTsCheckerWebpackPluginState, createForkTsCheckerWebpackPluginState };
