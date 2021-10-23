import * as chalk from 'chalk';
import type * as webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginConfig } from '../config';
import { getPluginHooks } from '../plugin-hooks';
import { RpcExitError } from '../utils/rpc';

function tapErrorToLogMessage(
  compiler: webpack.Compiler,
  config: ForkTsCheckerWebpackPluginConfig
) {
  const hooks = getPluginHooks(compiler);

  hooks.error.tap('ForkTsCheckerWebpackPlugin', (error) => {
    config.logger.error(error);

    if (error instanceof RpcExitError) {
      if (error.signal === 'SIGINT') {
        config.logger.error(
          chalk.red(
            'Issues checking service interrupted - If running in a docker container, this may be caused ' +
              "by the container running out of memory. If so, try increasing the container's memory limit " +
              'or lowering the `memoryLimit` value in the ForkTsCheckerWebpackPlugin configuration.'
          )
        );
      } else {
        config.logger.error(
          chalk.red(
            'Issues checking service aborted - probably out of memory. ' +
              'Check the `memoryLimit` option in the ForkTsCheckerWebpackPlugin configuration.\n' +
              "If increasing the memory doesn't solve the issue, it's most probably a bug in the TypeScript."
          )
        );
      }
    }
  });
}

export { tapErrorToLogMessage };
