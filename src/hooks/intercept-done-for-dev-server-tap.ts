import type * as webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginState } from '../state';

function interceptDoneForDevServerTap(
  compiler: webpack.Compiler,
  state: ForkTsCheckerWebpackPluginState
) {
  // inspired by https://github.com/ypresto/fork-ts-checker-async-overlay-webpack-plugin
  compiler.hooks.done.intercept({
    register: (tap) => {
      if (tap.name === 'webpack-dev-server' && tap.type === 'sync') {
        state.webpackDevServerDoneTap = tap;
      }
      return tap;
    },
  });
}

export { interceptDoneForDevServerTap };
