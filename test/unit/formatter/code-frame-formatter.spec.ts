import fs from 'fs';
import * as os from 'os';
import path from 'path';

import { createCodeFrameFormatter } from 'src/formatter';
import type { Issue } from 'src/issue';

import { stripAnsi } from './strip-ansi';

describe('formatter/code-frame-formatter', () => {
  let tempDirectory: string;

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'code-frame-formatter-'));
    fs.writeFileSync(
      path.join(tempDirectory, 'index.ts'),
      [
        'const foo: number = "1";',
        'const bar = 1;',
        '',
        'function baz() {',
        '  console.log(baz);',
        '}',
      ].join('\n')
    );
  });

  afterEach(() => {
    fs.rmSync(tempDirectory, { recursive: true });
  });

  it.each([
    [
      {
        severity: 'error',
        code: 'TS2322',
        message: `Type '"1"' is not assignable to type 'number'.`,
        file: 'index.ts',
        location: {
          start: {
            line: 1,
            column: 7,
          },
          end: {
            line: 1,
            column: 10,
          },
        },
      },
      [
        `TS2322: Type '"1"' is not assignable to type 'number'.`,
        '  > 1 | const foo: number = "1";',
        '      |       ^^^',
        '    2 | const bar = 1;',
      ].join(os.EOL),
    ],
    [
      {
        severity: 'error',
        code: 'TS2322',
        message: `Type '"1"' is not assignable to type 'number'.`,
        file: 'index.ts',
      },
      `TS2322: Type '"1"' is not assignable to type 'number'.`,
    ],
    [
      {
        severity: 'error',
        code: 'TS2322',
        message: `Type '"1"' is not assignable to type 'number'.`,
        file: 'index.ts',
        location: {
          start: {
            line: 1,
            column: 7,
          },
        },
      },
      [
        `TS2322: Type '"1"' is not assignable to type 'number'.`,
        '  > 1 | const foo: number = "1";',
        '      |       ^',
        '    2 | const bar = 1;',
      ].join(os.EOL),
    ],
    [
      {
        severity: 'error',
        code: 'TS2322',
        message: `Type '"1"' is not assignable to type 'number'.`,
        file: 'not-existing.ts',
        location: {
          start: {
            line: 1,
            column: 7,
          },
          end: {
            line: 1,
            column: 10,
          },
        },
      },
      `TS2322: Type '"1"' is not assignable to type 'number'.`,
    ],
  ])('formats issue message "%p" to "%p"', (...args) => {
    const [issue, expectedFormatted] = args as [Issue, string];
    const formatter = createCodeFrameFormatter({
      linesAbove: 1,
      linesBelow: 1,
    });
    const formatted = stripAnsi(
      formatter({ ...issue, file: path.join(tempDirectory, issue.file) })
    );

    expect(formatted).toEqual(expectedFormatted);
  });
});
