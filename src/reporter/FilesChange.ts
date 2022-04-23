import subtract from '../utils/array/substract';
import unique from '../utils/array/unique';
import { Compiler } from 'webpack';

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

const compilerFilesChangeMap = new WeakMap<Compiler, FilesChange>();

function getFilesChange(compiler: Compiler): FilesChange {
  const { changedFiles = [], deletedFiles = [] } = compilerFilesChangeMap.get(compiler) || {
    changedFiles: [],
    deletedFiles: [],
  };

  return {
    changedFiles: changedFiles.filter((changedFile) => !isIgnoredFile(changedFile)),
    deletedFiles: deletedFiles.filter((deletedFile) => !isIgnoredFile(deletedFile)),
  };
}

function updateFilesChange(compiler: Compiler, change: FilesChange): void {
  compilerFilesChangeMap.set(compiler, aggregateFilesChanges([getFilesChange(compiler), change]));
}

function clearFilesChange(compiler: Compiler): void {
  compilerFilesChangeMap.delete(compiler);
}

/**
 * Computes aggregated files change based on the subsequent files changes.
 *
 * @param changes List of subsequent files changes
 * @returns Files change that represents all subsequent changes as a one event
 */
function aggregateFilesChanges(changes: FilesChange[]): FilesChange {
  let changedFiles: string[] = [];
  let deletedFiles: string[] = [];

  for (const change of changes) {
    changedFiles = unique(
      subtract(changedFiles, change.deletedFiles).concat(change.changedFiles || [])
    );
    deletedFiles = unique(
      subtract(deletedFiles, change.changedFiles).concat(change.deletedFiles || [])
    );
  }

  return {
    changedFiles,
    deletedFiles,
  };
}

export { FilesChange, getFilesChange, updateFilesChange, clearFilesChange, aggregateFilesChanges };
