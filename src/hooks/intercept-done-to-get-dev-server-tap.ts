import type * as webpack from 'webpack';

import { getInfrastructureLogger } from '../infrastructure-logger';
import type { ForkTsCheckerWebpackPluginConfig } from '../plugin-config';
import type { ForkTsCheckerWebpackPluginState } from '../plugin-state';

function interceptDoneToGetDevServerTap(
  compiler: webpack.Compiler,
  config: ForkTsCheckerWebpackPluginConfig,
  state: ForkTsCheckerWebpackPluginState
) {
  const { debug } = getInfrastructureLogger(compiler);

  // inspired by https://github.com/ypresto/fork-ts-checker-async-overlay-webpack-plugin
  compiler.hooks.done.intercept({
    register: (tap) => {
      if (tap.name === 'webpack-dev-server' && tap.type === 'sync' && config.devServer) {
        debug('Intercepting webpack-dev-server tap.');
        state.webpackDevServerDoneTap = tap;
      }
      return tap;
    },
  });
}

export { interceptDoneToGetDevServerTap };
