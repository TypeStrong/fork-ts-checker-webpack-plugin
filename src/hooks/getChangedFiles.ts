/* eslint-disable @typescript-eslint/no-explicit-any */
import webpack from 'webpack';
import path from 'path';
import { getWatcher } from './getWatcher';

function getChangedFiles(compiler: webpack.Compiler): string[] {
  let changedFiles: string[] = [];

  if ((compiler as any).modifiedFiles) {
    // webpack 5+
    changedFiles = Array.from((compiler as any).modifiedFiles);
  } else {
    const watcher = getWatcher(compiler);
    // webpack 4
    changedFiles = Object.keys((watcher && watcher.mtimes) || {});
  }

  return (
    changedFiles
      // normalize paths
      .map((changedFile) => path.normalize(changedFile))
      // check if path is inside the context to filer-out some trash from fs
      .filter(
        (changedFile) =>
          !compiler.options.context ||
          changedFile.startsWith(path.normalize(compiler.options.context))
      )
  );
}

export { getChangedFiles };
