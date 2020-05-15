import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getWatcher } from './getWatcher';

function tapDoneToCollectChangedAndRemoved(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  compiler.hooks.done.tap('ForkTsCheckerWebpackPlugin', (stats) => {
    state.changedFiles = [];
    state.removedFiles = [];

    // the new watcher is defined after done hook
    // we need this for webpack < 5, because modifiedFiles and removedFiles set is not provided
    // this hook can be removed when we drop support for webpack 4
    setImmediate(() => {
      const compiler = stats.compilation.compiler;
      const watcher = getWatcher(compiler);

      if (watcher) {
        watcher.on('change', (filePath: string) => {
          state.changedFiles.push(filePath);
        });
        watcher.on('remove', (filePath: string) => {
          state.removedFiles.push(filePath);
        });
        // webpack will automatically clean-up listeners
      }
    });
  });
}

export { tapDoneToCollectChangedAndRemoved };
