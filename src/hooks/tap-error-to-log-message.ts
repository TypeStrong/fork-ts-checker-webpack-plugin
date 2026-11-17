import type * as webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginConfig } from '../plugin-config';
import { getPluginHooks } from '../plugin-hooks';
import { AbortError } from '../utils/async/abort-error';

function tapErrorToLogMessage(
  compiler: webpack.Compiler,
  config: ForkTsCheckerWebpackPluginConfig
) {
  const hooks = getPluginHooks(compiler);

  hooks.error.tap('ForkTsCheckerWebpackPlugin', (error) => {
    if (error instanceof AbortError) {
      return;
    }

    config.logger.error(String(error));
  });
}

export { tapErrorToLogMessage };
