import type webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import type { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getInfrastructureLogger } from '../infrastructure-logger';

function tapAfterCompileToAddDependencies(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  const { debug } = getInfrastructureLogger(compiler);

  compiler.hooks.afterCompile.tapPromise('ForkTsCheckerWebpackPlugin', async (compilation) => {
    if (compilation.compiler !== compiler) {
      // run only for the compiler that the plugin was registered for
      return;
    }

    const dependencies = await state.dependenciesPromise;

    debug(`Got dependencies from the getDependenciesWorker.`, dependencies);
    if (dependencies) {
      state.lastDependencies = dependencies;

      dependencies.files.forEach((file) => {
        compilation.fileDependencies.add(file);
      });
    }
  });
}

export { tapAfterCompileToAddDependencies };
