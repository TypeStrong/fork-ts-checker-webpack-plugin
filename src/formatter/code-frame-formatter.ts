import fs from 'fs';
import os from 'os';

import { codeFrameColumns } from '@babel/code-frame';
import type { Options as BabelCodeFrameOptions } from '@babel/code-frame';

import { createBasicFormatter } from './basic-formatter';
import type { Formatter } from './formatter';

function createCodeFrameFormatter(options?: BabelCodeFrameOptions): Formatter {
  const basicFormatter = createBasicFormatter();

  return function codeFrameFormatter(issue) {
    const source = issue.file && fs.existsSync(issue.file) && fs.readFileSync(issue.file, 'utf-8');

    let frame = '';
    if (source && issue.location) {
      // issue columns are 1-based, @babel/code-frame 8 expects 0-based columns
      const { start, end } = issue.location;
      const location = {
        start: { line: start.line, column: start.column - 1 },
        // custom issues may come without an end position
        end: end && { line: end.line, column: end.column - 1 },
      };

      frame = codeFrameColumns(source, location, {
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

export { createCodeFrameFormatter };
export type { BabelCodeFrameOptions };
