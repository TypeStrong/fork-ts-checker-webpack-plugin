import type * as webpack from 'webpack';

import { getInfrastructureLogger } from '../infrastructure-logger';
import type { ForkTsCheckerWebpackPluginState } from '../plugin-state';
import type { RpcWorker } from '../rpc';

function tapStopToTerminateWorkers(
  compiler: webpack.Compiler,
  getIssuesWorker: RpcWorker,
  getDependenciesWorker: RpcWorker,
  state: ForkTsCheckerWebpackPluginState
) {
  const { debug } = getInfrastructureLogger(compiler);

  const terminateWorkers = () => {
    debug('Compiler is going to close - terminating workers...');
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
