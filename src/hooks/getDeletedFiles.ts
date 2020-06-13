/* eslint-disable @typescript-eslint/no-explicit-any */
import webpack from 'webpack';
import path from 'path';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';

function getDeletedFiles(
  compiler: webpack.Compiler,
  state: ForkTsCheckerWebpackPluginState
): string[] {
  let deletedFiles: string[] = [];

  if ((compiler as any).removedFiles) {
    // webpack 5+
    deletedFiles = Array.from((compiler as any).removedFiles || []);
  } else {
    // webpack 4
    deletedFiles = [...state.removedFiles];
  }

  return deletedFiles.map((changedFile) => path.normalize(changedFile));
}

export { getDeletedFiles };
