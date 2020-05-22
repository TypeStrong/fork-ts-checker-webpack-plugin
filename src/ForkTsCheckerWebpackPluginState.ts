import { Report } from './reporter';
import { Tap } from 'tapable';

interface ForkTsCheckerWebpackPluginState {
  report: Promise<Report | undefined>;
  removedFiles: string[];
  watching: boolean;
  initialized: boolean;
  webpackDevServerDoneTap: Tap | undefined;
}

function createForkTsCheckerWebpackPluginState(): ForkTsCheckerWebpackPluginState {
  return {
    report: Promise.resolve([]),
    removedFiles: [],
    watching: false,
    initialized: false,
    webpackDevServerDoneTap: undefined,
  };
}

export { ForkTsCheckerWebpackPluginState, createForkTsCheckerWebpackPluginState };
