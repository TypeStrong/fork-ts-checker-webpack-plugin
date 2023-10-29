import type * as webpack from 'webpack';

import { getInfrastructureLogger } from '../infrastructure-logger';
import type { ForkTsCheckerWebpackPluginState } from '../plugin-state';
import { InclusiveNodeWatchFileSystem } from '../watch/inclusive-node-watch-file-system';
import type { WatchFileSystem } from '../watch/watch-file-system';

function tapAfterEnvironmentToPatchWatching(
  compiler: webpack.Compiler,
  state: ForkTsCheckerWebpackPluginState
) {
  const { debug } = getInfrastructureLogger(compiler);

  compiler.hooks.afterEnvironment.tap('ForkTsCheckerWebpackPlugin', () => {
    const watchFileSystem = compiler.watchFileSystem;
    if (watchFileSystem) {
      debug("Overwriting webpack's watch file system.");
      // wrap original watch file system
      compiler.watchFileSystem = new InclusiveNodeWatchFileSystem(
        // we use some internals here
        watchFileSystem as WatchFileSystem,
        compiler,
        state
      );
    } else {
      debug('No watch file system found - plugin may not work correctly.');
    }
  });
}

export { tapAfterEnvironmentToPatchWatching };
