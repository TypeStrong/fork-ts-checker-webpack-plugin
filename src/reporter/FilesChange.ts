import subtract from '../utils/array/substract';
import unique from '../utils/array/unique';
import intersect from '../utils/array/intersect';
import { aggregateFilesState } from './FilesState';

interface FilesChange {
  createdFiles?: string[];
  changedFiles?: string[];
  deletedFiles?: string[];
}

function aggregateFilesChanges(changes: FilesChange[]): FilesChange {
  const { nonExistedFiles, existedFiles } = aggregateFilesState(changes);

  return changes.reduce<FilesChange>(
    (aggregated, change) => ({
      createdFiles: unique([
        ...subtract(aggregated.createdFiles, change.deletedFiles),
        ...intersect(change.createdFiles, nonExistedFiles),
      ]),
      changedFiles: unique([
        ...subtract(aggregated.changedFiles, change.deletedFiles),
        ...intersect(change.changedFiles, existedFiles),
        ...intersect(change.createdFiles, existedFiles),
      ]),
      deletedFiles: unique([
        ...subtract(aggregated.deletedFiles, change.createdFiles),
        ...intersect(change.deletedFiles, existedFiles),
      ]),
    }),
    {
      createdFiles: [],
      changedFiles: [],
      deletedFiles: [],
    }
  );
}

export { FilesChange, aggregateFilesChanges };
