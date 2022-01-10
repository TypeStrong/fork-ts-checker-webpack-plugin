import chalk from 'chalk';
import type webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { RpcExitError } from '../utils/rpc';

import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';

function tapErrorToLogMessage(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration
) {
  const hooks = getForkTsCheckerWebpackPluginHooks(compiler);

  hooks.error.tap('ForkTsCheckerWebpackPlugin', (error) => {
    configuration.logger.issues.error(String(error));

    if (error instanceof RpcExitError) {
      if (error.signal === 'SIGINT') {
        configuration.logger.issues.error(
          chalk.red(
            'Issues checking service interrupted - If running in a docker container, this may be caused ' +
              "by the container running out of memory. If so, try increasing the container's memory limit " +
              'or lowering the `memoryLimit` value in the ForkTsCheckerWebpackPlugin configuration.'
          )
        );
      } else {
        configuration.logger.issues.error(
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
