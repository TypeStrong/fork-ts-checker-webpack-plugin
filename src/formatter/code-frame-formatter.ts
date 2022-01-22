import os from 'os';

import { codeFrameColumns } from '@babel/code-frame';
import fs from 'fs-extra';

import { createBasicFormatter } from './basic-formatter';
import type { Formatter } from './formatter';
import { BabelCodeFrameOptions } from './types/babel__code-frame';

function createCodeFrameFormatter(options?: BabelCodeFrameOptions): Formatter {
  const basicFormatter = createBasicFormatter();

  return function codeFrameFormatter(issue) {
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

export { createCodeFrameFormatter, BabelCodeFrameOptions };
