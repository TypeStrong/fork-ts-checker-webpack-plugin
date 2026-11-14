import type { FilesChange } from '../../files-change';
import type { FilesMatch } from '../../files-match';
import { exposeRpc } from '../../rpc';

import { closeApi, closeApiOnExit } from './lib/api';
import {
  didConfigFileChanged,
  didDependenciesProbablyChanged,
  invalidateConfig,
} from './lib/config';
import { getConfigFiles, getDependencies, invalidateDependencies } from './lib/dependencies';

closeApiOnExit();

const getDependenciesWorker = (change: FilesChange): FilesMatch => {
  try {
    if (
      didConfigFileChanged(change, getConfigFiles()) ||
      didDependenciesProbablyChanged(getDependencies(), change)
    ) {
      invalidateConfig();
      invalidateDependencies();
    }

    return getDependencies();
  } catch (error) {
    // the compiler process may have died - start from scratch on the next call
    closeApi();
    invalidateConfig();
    invalidateDependencies();

    throw error;
  }
};

exposeRpc(getDependenciesWorker);
export type GetDependenciesWorker = typeof getDependenciesWorker;
