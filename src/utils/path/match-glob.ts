import picomatch from 'picomatch';

const isWindows = process.platform === 'win32';
// the patterns come from the plugin options, so there are only a few of them
const matchers = new Map<string, (path: string) => boolean>();

export function matchGlob(path: string, pattern: string): boolean {
  let matcher = matchers.get(pattern);
  if (!matcher) {
    // On Windows a backslash in a pattern is a path separator, as in a pattern
    // built with `path.join`. Everywhere else it escapes the next character.
    matcher = picomatch(isWindows ? pattern.replace(/\\/g, '/') : pattern, { windows: isWindows });
    matchers.set(pattern, matcher);
  }

  return matcher(path);
}
