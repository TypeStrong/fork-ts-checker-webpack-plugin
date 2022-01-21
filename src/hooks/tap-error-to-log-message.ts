import chalk from 'chalk';
import type webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginConfig } from '../plugin-config';
import { getPluginHooks } from '../plugin-hooks';
import { RpcExitError } from '../rpc';

function tapErrorToLogMessage(
  compiler: webpack.Compiler,
  config: ForkTsCheckerWebpackPluginConfig
) {
  const hooks = getPluginHooks(compiler);

  hooks.error.tap('ForkTsCheckerWebpackPlugin', (error) => {
    config.logger.issues.error(String(error));

    if (error instanceof RpcExitError) {
      if (error.signal === 'SIGINT') {
        config.logger.issues.error(
          chalk.red(
            'Issues checking service interrupted - If running in a docker container, this may be caused ' +
              "by the container running out of memory. If so, try increasing the container's memory limit " +
              'or lowering the `memoryLimit` value in the ForkTsCheckerWebpackPlugin configuration.'
          )
        );
      } else {
        config.logger.issues.error(
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
