import webpack from 'webpack';
import path from 'path';
import { CompilerWithWatchFileSystem } from '../watch/CompilerWithWatchFileSystem';
import { InclusiveNodeWatchFileSystem } from '../watch/InclusiveNodeWatchFileSystem';

function getDeletedFiles(compiler: webpack.Compiler): string[] {
  const watchFileSystem = (compiler as CompilerWithWatchFileSystem<InclusiveNodeWatchFileSystem>)
    .watchFileSystem;

  return watchFileSystem
    ? Array.from(watchFileSystem.removedFiles).map((removeFile) => path.normalize(removeFile))
    : [];
}

export { getDeletedFiles };
