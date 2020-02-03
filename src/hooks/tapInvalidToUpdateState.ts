import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import isFileJustCreated from '../utils/fs/isFileJustCreated';

function tapInvalidToUpdateState(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  compiler.hooks.invalid.tap('ForkTsCheckerWebpackPlugin', (fileName) => {
    if (isFileJustCreated(fileName)) {
      state.createdFiles.push(fileName);
    } else {
      state.changedFiles.push(fileName);
    }
  });
}

export { tapInvalidToUpdateState };
