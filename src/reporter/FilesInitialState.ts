import unique from '../utils/array/unique';
import subtract from '../utils/array/substract';
import { FilesChange } from './FilesChange';

interface FilesInitialState {
  filesThatDidExist: string[];
  filesThatDidntExist: string[];
}

/**
 * Computes initial state of files based on the list of subsequent files changes
 *
 * @param changes List of subsequent files changes
 * @returns Initial state of files that were created, changed or deleted
 */
function getFilesInitialState(changes: FilesChange[]): FilesInitialState {
  // list of files that did exist before
  const filesThatDidExist: string[] = [];
  // list of files that didn't exist before
  const filesThatDidntExist: string[] = [];

  // once the file is categorized, it can't be moved to a different category
  for (const change of changes) {
    // add changed and deleted files that were not registered as files that didn't exist
    filesThatDidExist.push(...subtract(change.changedFiles, filesThatDidntExist));
    filesThatDidExist.push(...subtract(change.deletedFiles, filesThatDidntExist));
    // add created files that were not registered as files that did exist
    filesThatDidntExist.push(...subtract(change.createdFiles, filesThatDidExist));
  }

  return {
    filesThatDidExist: unique(filesThatDidExist),
    filesThatDidntExist: unique(filesThatDidntExist),
  };
}

export { getFilesInitialState, FilesInitialState };
