import path from 'path';

import forwardSlash from './forwardSlash';

function relativeToContext(file: string, context: string) {
  let fileInContext = forwardSlash(path.relative(context, file));
  if (!fileInContext.startsWith('../')) {
    fileInContext = './' + fileInContext;
  }

  return fileInContext;
}

export { relativeToContext };
