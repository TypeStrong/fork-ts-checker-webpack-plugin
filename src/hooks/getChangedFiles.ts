/* eslint-disable @typescript-eslint/no-explicit-any */
import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';

function getChangedFiles(
  compiler: webpack.Compiler,
  state: ForkTsCheckerWebpackPluginState
): string[] {
  if ((compiler as any).modifiedFiles) {
    // webpack 5+
    return Array.from((compiler as any).modifiedFiles);
  } else {
    // webpack 4
    return state.changedFiles;
  }
}

export { getChangedFiles };
