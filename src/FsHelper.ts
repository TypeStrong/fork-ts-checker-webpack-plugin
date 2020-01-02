import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throwIfIsInvalidSourceFileError(filepath: string, error: any) {
  if (
    fs.existsSync(filepath) &&
    // check the error type due to file system lag
    !(error instanceof Error) &&
    !(error.constructor.name === 'FatalError') &&
    !(error.message && error.message.trim().startsWith('Invalid source file'))
  ) {
    // it's not because file doesn't exist - throw error
    throw error;
  }
}
