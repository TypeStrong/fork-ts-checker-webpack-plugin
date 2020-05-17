/* eslint-disable @typescript-eslint/no-explicit-any */
import webpack from 'webpack';
import { getWatcher } from './getWatcher';

function getChangedFiles(compiler: webpack.Compiler): string[] {
  if ((compiler as any).modifiedFiles) {
    // webpack 5+
    return Array.from((compiler as any).modifiedFiles);
  } else {
    const watcher = getWatcher(compiler);
    // webpack 4
    return Object.keys((watcher && watcher.mtimes) || {});
  }
}

export { getChangedFiles };
