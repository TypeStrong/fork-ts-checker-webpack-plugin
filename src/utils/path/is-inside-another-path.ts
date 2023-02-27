import { relative, isAbsolute } from 'path';

function isInsideAnotherPath(parent: string, directory: string): boolean {
  const relativePart = relative(parent, directory);
  // Tested folder is above parent.
  if (relativePart.startsWith('..')) {
    return false;
  }
  // Tested folder is the same as parent.
  if (relativePart.length === 0) {
    return false;
  }
  // Tested directory has nothing in common with parent.
  if (isAbsolute(relativePart)) {
    return false;
  }
  // Last option, must be subfolder.
  return true;
}

export { isInsideAnotherPath };
