import type webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { InclusiveNodeWatchFileSystem } from '../watch/InclusiveNodeWatchFileSystem';
import type { WatchFileSystem } from '../watch/WatchFileSystem';

function tapAfterEnvironmentToPatchWatching(
  compiler: webpack.Compiler,
  state: ForkTsCheckerWebpackPluginState
) {
  compiler.hooks.afterEnvironment.tap('ForkTsCheckerWebpackPlugin', () => {
    const watchFileSystem = compiler.watchFileSystem;
    if (watchFileSystem) {
      // wrap original watch file system
      compiler.watchFileSystem = new InclusiveNodeWatchFileSystem(
        // we use some internals here
        watchFileSystem as WatchFileSystem,
        compiler,
        state
      );
    }
  });
}

export { tapAfterEnvironmentToPatchWatching };
