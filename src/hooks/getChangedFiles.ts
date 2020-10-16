import webpack from 'webpack';
import path from 'path';
import { CompilerWithWatchFileSystem } from '../watch/CompilerWithWatchFileSystem';
import { InclusiveNodeWatchFileSystem } from '../watch/InclusiveNodeWatchFileSystem';

function getChangedFiles(compiler: webpack.Compiler): string[] {
  const watchFileSystem = (compiler as CompilerWithWatchFileSystem<InclusiveNodeWatchFileSystem>)
    .watchFileSystem;

  return watchFileSystem
    ? Array.from(watchFileSystem.changedFiles).map((changedFile) => path.normalize(changedFile))
    : [];
}

export { getChangedFiles };
