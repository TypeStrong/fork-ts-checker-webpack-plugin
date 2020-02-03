import unique from '../utils/array/unique';
import subtract from '../utils/array/substract';
import { FilesChange } from './FilesChange';

interface FilesState {
  nonExistedFiles: string[];
  existedFiles: string[];
}

function aggregateFilesState(changes: FilesChange[]): FilesState {
  return changes.reduce<FilesState>(
    ({ nonExistedFiles, existedFiles }, increment) => ({
      nonExistedFiles: unique([
        ...nonExistedFiles,
        ...subtract(increment.createdFiles, existedFiles),
      ]),
      existedFiles: unique([
        ...existedFiles,
        ...(increment.changedFiles || []),
        ...(increment.deletedFiles || []),
      ]),
    }),
    {
      nonExistedFiles: [],
      existedFiles: [],
    }
  );
}

export { aggregateFilesState, FilesState };
