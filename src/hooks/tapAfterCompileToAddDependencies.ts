import type webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import type { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';

function tapAfterCompileToAddDependencies(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  compiler.hooks.afterCompile.tapPromise('ForkTsCheckerWebpackPlugin', async (compilation) => {
    if (compilation.compiler !== compiler) {
      // run only for the compiler that the plugin was registered for
      return;
    }

    const dependencies = await state.dependenciesPromise;

    if (dependencies) {
      state.lastDependencies = dependencies;

      dependencies.files.forEach((file) => {
        compilation.fileDependencies.add(file);
      });
    }
  });
}

export { tapAfterCompileToAddDependencies };
