import forwardSlash from './forwardSlash';
import path from 'path';

function relativeToContext(file: string, context: string) {
  let fileInContext = forwardSlash(path.relative(context, file));
  if (!fileInContext.startsWith('../')) {
    fileInContext = './' + fileInContext;
  }

  return fileInContext;
}

export { relativeToContext };
