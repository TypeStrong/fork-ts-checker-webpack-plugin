import * as os from 'os';
import mockFs from 'mock-fs';
import { Issue } from 'lib/issue';
import { createCodeFrameFormatter } from 'lib/formatter';

describe('formatter/CodeFrameFormatter', () => {
  beforeEach(() => {
    mockFs({
      src: {
        'index.ts': [
          'const foo: number = "1";',
          'const bar = 1;',
          '',
          'function baz() {',
          '  console.log(baz);',
          '}',
        ].join('\n'),
      },
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it.each([
    [
      {
        severity: 'error',
        code: 'TS2322',
        message: `Type '"1"' is not assignable to type 'number'.`,
        file: 'src/index.ts',
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
        file: 'src/index.ts',
      },
      `TS2322: Type '"1"' is not assignable to type 'number'.`,
    ],
    [
      {
        severity: 'error',
        code: 'TS2322',
        message: `Type '"1"' is not assignable to type 'number'.`,
        file: 'src/index.ts',
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
        file: 'src/not-existing.ts',
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
    const formatted = formatter(issue);

    expect(formatted).toEqual(expectedFormatted);
  });
});
