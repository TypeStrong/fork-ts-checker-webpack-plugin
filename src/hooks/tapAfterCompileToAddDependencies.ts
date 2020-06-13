import webpack from 'webpack';
import path from 'path';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';

function tapAfterCompileToAddDependencies(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration
) {
  compiler.hooks.afterCompile.tap('ForkTsCheckerWebpackPlugin', (compilation) => {
    if (configuration.typescript.enabled) {
      // watch tsconfig.json file
      compilation.fileDependencies.add(path.normalize(configuration.typescript.configFile));
    }
  });
}

export { tapAfterCompileToAddDependencies };
