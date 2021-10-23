import type { Issue } from '../issue';

import type { FilesMatch } from './FilesMatch';

interface Report {
  getDependencies(): Promise<FilesMatch>;
  getIssues(): Promise<Issue[]>;
  close(): Promise<void>;
}

export { Report };
