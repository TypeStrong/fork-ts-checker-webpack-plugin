import webpack from 'webpack';

function getDeletedFiles(compiler: webpack.Compiler): string[] {
  // TODO: investigate webpack version support for this method
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Array.from((compiler as any).removedFiles) || [];
}

export { getDeletedFiles };
