import type { FilesChange } from '../../files-change';
import type { FilesMatch } from '../../files-match';
import { exposeRpc } from '../../utils/rpc';

import { didConfigFileChanged, didRootFilesChanged, invalidateConfig } from './lib/config';
import { getDependencies, invalidateDependencies } from './lib/dependencies';
import { system } from './lib/system';

const getDependenciesWorker = ({
  changedFiles = [],
  deletedFiles = [],
}: FilesChange): FilesMatch => {
  system.invalidateCache();

  if (didConfigFileChanged({ changedFiles, deletedFiles })) {
    invalidateConfig();
    invalidateDependencies();
  } else if (didRootFilesChanged()) {
    invalidateDependencies();
  }

  return getDependencies();
};

exposeRpc(getDependenciesWorker);
export type GetDependenciesWorker = typeof getDependenciesWorker;
