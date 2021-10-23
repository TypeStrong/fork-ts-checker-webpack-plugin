import type * as webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginState } from '../state';
import { InclusiveNodeWatchFileSystem } from '../watch/inclusive-node-watch-file-system';
import type { WatchFileSystem } from '../watch/watch-file-system';

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
