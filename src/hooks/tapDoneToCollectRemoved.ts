import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getWatcher } from './getWatcher';

function tapDoneToCollectRemoved(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  compiler.hooks.done.tap('ForkTsCheckerWebpackPlugin', (stats) => {
    if (stats.compilation.compiler !== compiler) {
      // run only for the compiler that the plugin was registered for
      return;
    }

    state.removedFiles = [];

    // the new watcher is defined after done hook
    // we need this for webpack < 5, because removedFiles set is not provided
    // this hook can be removed when we drop support for webpack 4
    setImmediate(() => {
      const compiler = stats.compilation.compiler;
      const watcher = getWatcher(compiler);

      if (watcher) {
        watcher.on('remove', (filePath: string) => {
          state.removedFiles.push(filePath);
        });
        // webpack will automatically clean-up listeners
      }
    });
  });
}

export { tapDoneToCollectRemoved };
