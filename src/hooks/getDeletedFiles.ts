/* eslint-disable @typescript-eslint/no-explicit-any */
import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';

function getDeletedFiles(
  compiler: webpack.Compiler,
  state: ForkTsCheckerWebpackPluginState
): string[] {
  if ((compiler as any).removedFiles) {
    // webpack 5+
    return Array.from((compiler as any).removedFiles || []);
  } else {
    // webpack 4
    return [...state.removedFiles];
  }
}

export { getDeletedFiles };
