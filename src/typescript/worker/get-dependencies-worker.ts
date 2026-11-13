import type { FilesChange } from '../../files-change';
import type { FilesMatch } from '../../files-match';
import { exposeRpc } from '../../rpc';

import { closeApiOnExit } from './lib/api';
import {
  didConfigFileChanged,
  didDependenciesProbablyChanged,
  invalidateConfig,
} from './lib/config';
import { getDependencies, invalidateDependencies } from './lib/dependencies';

closeApiOnExit();

const getDependenciesWorker = (change: FilesChange): FilesMatch => {
  if (didConfigFileChanged(change) || didDependenciesProbablyChanged(getDependencies(), change)) {
    invalidateConfig();
    invalidateDependencies();
  }

  return getDependencies();
};

exposeRpc(getDependenciesWorker);
export type GetDependenciesWorker = typeof getDependenciesWorker;
