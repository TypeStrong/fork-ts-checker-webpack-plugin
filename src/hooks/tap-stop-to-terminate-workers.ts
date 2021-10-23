import type * as webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginState } from '../state';
import type { RpcWorker } from '../utils/rpc';

function tapStopToTerminateWorkers(
  compiler: webpack.Compiler,
  state: ForkTsCheckerWebpackPluginState,
  getIssuesWorker: RpcWorker,
  getDependenciesWorker: RpcWorker
) {
  const terminateWorkers = () => {
    getIssuesWorker.terminate();
    getDependenciesWorker.terminate();
  };

  compiler.hooks.watchClose.tap('ForkTsCheckerWebpackPlugin', () => {
    terminateWorkers();
  });

  compiler.hooks.done.tap('ForkTsCheckerWebpackPlugin', () => {
    if (!state.watching) {
      terminateWorkers();
    }
  });

  compiler.hooks.failed.tap('ForkTsCheckerWebpackPlugin', () => {
    if (!state.watching) {
      terminateWorkers();
    }
  });
}

export { tapStopToTerminateWorkers };
