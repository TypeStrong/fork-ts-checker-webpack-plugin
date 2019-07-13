import * as fs from 'fs';

export function fileExistsSync(filePath: fs.PathLike) {
  try {
    fs.statSync(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    } else {
      throw err;
    }
  }
  return true;
}

export function throwIfIsInvalidSourceFileError(filepath: string, error: any) {
  if (
    fileExistsSync(filepath) &&
    // check the error type due to file system lag
    !(error instanceof Error) &&
    !(error.constructor.name === 'FatalError') &&
    !(error.message && error.message.trim().startsWith('Invalid source file'))
  ) {
    // it's not because file doesn't exist - throw error
    throw error;
  }
}
