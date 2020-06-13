import stripAnsi from 'strip-ansi';

function isLineRelatedToTsLoader(line: string) {
  return line.includes('[tsl]') || line.includes('ts-loader');
}

function extractWebpackErrors(content: string): string[] {
  const lines = stripAnsi(content).split(/\r\n?|\n/);
  const errors: string[] = [];
  let currentError: string | undefined = undefined;

  for (const line of lines) {
    if (currentError) {
      if (line === '') {
        errors.push(currentError);
        currentError = undefined;
      } else {
        if (isLineRelatedToTsLoader(line)) {
          currentError = undefined;
        } else {
          currentError += '\n' + line;
        }
      }
    } else {
      if (
        (line.startsWith('ERROR') || line.startsWith('WARNING')) &&
        !isLineRelatedToTsLoader(line)
      ) {
        currentError = line;
      }
    }
  }

  return errors;
}

export { extractWebpackErrors };
