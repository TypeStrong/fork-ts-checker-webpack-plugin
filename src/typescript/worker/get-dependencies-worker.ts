import type { FilesChange } from '../../files-change';
import type { FilesMatch } from '../../files-match';
import { exposeRpc } from '../../rpc';

import {
  didConfigFileChanged,
  didDependenciesProbablyChanged,
  invalidateConfig,
} from './lib/config';
import { getDependencies, invalidateDependencies } from './lib/dependencies';
import { system } from './lib/system';

const getDependenciesWorker = (change: FilesChange): FilesMatch => {
  system.invalidateCache();

  if (didConfigFileChanged(change) || didDependenciesProbablyChanged(getDependencies(), change)) {
    invalidateConfig();
    invalidateDependencies();
  }

  return getDependencies();
};

exposeRpc(getDependenciesWorker);
export type GetDependenciesWorker = typeof getDependenciesWorker;
