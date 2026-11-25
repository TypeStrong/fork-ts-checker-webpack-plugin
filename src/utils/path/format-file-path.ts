import path from 'path';

import { forwardSlash } from './forward-slash';
import { relativeToContext } from './relative-to-context';

/** The file path as shown in issues: absolute, or relative to the current working directory. */
function formatFilePath(file: string, pathType: 'relative' | 'absolute'): string {
  return pathType === 'absolute'
    ? forwardSlash(path.resolve(file))
    : relativeToContext(file, process.cwd());
}

export { formatFilePath };
