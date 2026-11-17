import type * as webpack from 'webpack';

import { getInfrastructureLogger } from '../infrastructure-logger';
import type { ForkTsCheckerWebpackPluginState } from '../plugin-state';
import type { TypeScriptService } from '../typescript/service/type-script-service';

/**
 * The native compiler processes keep the Node.js process alive, so they have to
 * be stopped once webpack is done.
 */
function tapStopToCloseService(
  compiler: webpack.Compiler,
  typescriptService: TypeScriptService,
  state: ForkTsCheckerWebpackPluginState
) {
  const { debug } = getInfrastructureLogger(compiler);

  const closeService = () => {
    debug('Compiler is going to close - stopping the TypeScript service...');
    // closing never rejects
    void typescriptService.close();
  };

  compiler.hooks.watchClose.tap('ForkTsCheckerWebpackPlugin', () => {
    closeService();
  });

  compiler.hooks.done.tap('ForkTsCheckerWebpackPlugin', () => {
    if (!state.watching) {
      closeService();
    }
  });

  compiler.hooks.failed.tap('ForkTsCheckerWebpackPlugin', () => {
    if (!state.watching) {
      closeService();
    }
  });
}

export { tapStopToCloseService };
