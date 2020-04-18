import subtract from '../utils/array/substract';
import unique from '../utils/array/unique';
import intersect from '../utils/array/intersect';
import { getFilesInitialState } from './FilesInitialState';

interface FilesChange {
  createdFiles?: string[];
  changedFiles?: string[];
  deletedFiles?: string[];
}

/**
 * Computes aggregated files change based on the subsequent files changes.
 *
 * @param changes List of subsequent files changes
 * @returns Files change that represents all subsequent changes as a one event
 */
function aggregateFilesChanges(changes: FilesChange[]): FilesChange {
  const { filesThatDidntExist, filesThatDidExist } = getFilesInitialState(changes);

  let createdFiles: string[] = [];
  let changedFiles: string[] = [];
  let deletedFiles: string[] = [];

  for (const change of changes) {
    // subtract deleted files from created files
    createdFiles = subtract(createdFiles, change.deletedFiles);
    // add new created files if didn't exist before
    createdFiles.push(...intersect(change.createdFiles, filesThatDidntExist));

    // subtract deleted files from changed files
    changedFiles = subtract(changedFiles, change.deletedFiles);
    // add new created files if did exist before
    changedFiles.push(...intersect(change.createdFiles, filesThatDidExist));
    // add new changed files if did exist before
    changedFiles.push(...intersect(change.changedFiles, filesThatDidExist));

    // subtract created files from deleted files
    deletedFiles = subtract(deletedFiles, change.createdFiles);
    // add new deleted files if did exist before
    deletedFiles.push(...intersect(change.deletedFiles, filesThatDidExist));
  }

  return {
    createdFiles: unique(createdFiles),
    changedFiles: unique(changedFiles),
    deletedFiles: unique(deletedFiles),
  };
}

export { FilesChange, aggregateFilesChanges };
