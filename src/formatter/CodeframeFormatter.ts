import os from 'os';
import fs from 'fs-extra';
import { codeFrameColumns, BabelCodeFrameOptions } from '@babel/code-frame';
import { Formatter } from './Formatter';
import { createBasicFormatter } from './BasicFormatter';

function createCodeframeFormatter(options?: BabelCodeFrameOptions): Formatter {
  const basicFormatter = createBasicFormatter();

  return function codeframeFormatter(issue) {
    const source = issue.file && fs.existsSync(issue.file) && fs.readFileSync(issue.file, 'utf-8');

    let frame = '';
    if (source && issue.location) {
      frame = codeFrameColumns(source, issue.location, {
        highlightCode: true,
        ...(options || {}),
      })
        .split('\n')
        .map((line) => '  ' + line)
        .join(os.EOL);
    }

    const lines = [basicFormatter(issue)];
    if (frame) {
      lines.push(frame);
    }

    return lines.join(os.EOL);
  };
}

export { createCodeframeFormatter, BabelCodeFrameOptions };
