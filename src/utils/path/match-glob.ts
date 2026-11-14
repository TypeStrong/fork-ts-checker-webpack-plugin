import { minimatch } from 'minimatch';

// On Windows a backslash in a pattern is a path separator, as in a pattern built
// with `path.join`. Everywhere else it escapes the next character.
const options = { windowsPathsNoEscape: process.platform === 'win32' };

export function matchGlob(path: string, pattern: string): boolean {
  return minimatch(path, pattern, options);
}
