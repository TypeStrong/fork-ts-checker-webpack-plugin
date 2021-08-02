import subtract from '../utils/array/substract';
import unique from '../utils/array/unique';
import { Compiler } from 'webpack';

interface FilesChange {
  changedFiles?: string[];
  deletedFiles?: string[];
}

const compilerFilesChangeMap = new WeakMap<Compiler, FilesChange>();

function getFilesChange(compiler: Compiler): FilesChange {
  return compilerFilesChangeMap.get(compiler) || { changedFiles: [], deletedFiles: [] };
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
