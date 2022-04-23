import type * as webpack from 'webpack';

interface FilesChange {
  changedFiles?: string[];
  deletedFiles?: string[];
}

// we ignore package.json file because of https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/issues/674
const IGNORED_FILES = ['package.json'];

const isIgnoredFile = (file: string) =>
  IGNORED_FILES.some(
    (ignoredFile) => file.endsWith(`/${ignoredFile}`) || file.endsWith(`\\${ignoredFile}`)
  );

const compilerFilesChangeMap = new WeakMap<webpack.Compiler, FilesChange>();

function getFilesChange(compiler: webpack.Compiler): FilesChange {
  const { changedFiles = [], deletedFiles = [] } = compilerFilesChangeMap.get(compiler) || {
    changedFiles: [],
    deletedFiles: [],
  };

  return {
    changedFiles: changedFiles.filter((changedFile) => !isIgnoredFile(changedFile)),
    deletedFiles: deletedFiles.filter((deletedFile) => !isIgnoredFile(deletedFile)),
  };
}

function consumeFilesChange(compiler: webpack.Compiler): FilesChange {
  const change = getFilesChange(compiler);
  clearFilesChange(compiler);
  return change;
}

function updateFilesChange(compiler: webpack.Compiler, change: FilesChange): void {
  compilerFilesChangeMap.set(compiler, aggregateFilesChanges([getFilesChange(compiler), change]));
}

function clearFilesChange(compiler: webpack.Compiler): void {
  compilerFilesChangeMap.delete(compiler);
}

/**
 * Computes aggregated files change based on the subsequent files changes.
 *
 * @param changes List of subsequent files changes
 * @returns Files change that represents all subsequent changes as a one event
 */
function aggregateFilesChanges(changes: FilesChange[]): FilesChange {
  const changedFilesSet = new Set<string>();
  const deletedFilesSet = new Set<string>();

  for (const { changedFiles = [], deletedFiles = [] } of changes) {
    for (const changedFile of changedFiles) {
      changedFilesSet.add(changedFile);
      deletedFilesSet.delete(changedFile);
    }
    for (const deletedFile of deletedFiles) {
      changedFilesSet.delete(deletedFile);
      deletedFilesSet.add(deletedFile);
    }
  }

  return {
    changedFiles: Array.from(changedFilesSet),
    deletedFiles: Array.from(deletedFilesSet),
  };
}

export {
  FilesChange,
  getFilesChange,
  consumeFilesChange,
  updateFilesChange,
  clearFilesChange,
  aggregateFilesChanges,
};
