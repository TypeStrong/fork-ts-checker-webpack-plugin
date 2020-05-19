/**
 * Replaces backslashes with one forward slash
 * @param path
 */
function normalizeSlash(path: string): string {
  return path.replace(/\\+/g, '/');
}

export default normalizeSlash;
