import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { ReporterRpcClient } from '../reporter';

function tapStopToDisconnectReporter(
  compiler: webpack.Compiler,
  issuesReporter: ReporterRpcClient,
  dependenciesReporter: ReporterRpcClient,
  state: ForkTsCheckerWebpackPluginState
) {
  compiler.hooks.watchClose.tap('ForkTsCheckerWebpackPlugin', () => {
    issuesReporter.disconnect();
    dependenciesReporter.disconnect();
  });

  compiler.hooks.done.tap('ForkTsCheckerWebpackPlugin', async () => {
    if (!state.watching) {
      await Promise.all([issuesReporter.disconnect(), dependenciesReporter.disconnect()]);
    }
  });

  compiler.hooks.failed.tap('ForkTsCheckerWebpackPlugin', () => {
    if (!state.watching) {
      issuesReporter.disconnect();
      dependenciesReporter.disconnect();
    }
  });
}

export { tapStopToDisconnectReporter };
