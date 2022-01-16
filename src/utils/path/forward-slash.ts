import path from 'path';

/**
 * Replaces backslashes with one forward slash
 * @param input
 */
function forwardSlash(input: string): string {
  return path.normalize(input).replace(/\\+/g, '/');
}

export { forwardSlash };
