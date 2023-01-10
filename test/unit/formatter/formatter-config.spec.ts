import os from 'os';

import mockFs from 'mock-fs';
import type { FormatterOptions } from 'src/formatter';
import { createFormatterConfig } from 'src/formatter';
import type { Issue } from 'src/issue';

describe('formatter/formatter-config', () => {
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

  const issue: Issue = {
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
  };

  const customFormatter = (issue: Issue) =>
    `${issue.code}: ${issue.message} at line ${issue.location.start.line}`;

  const BASIC_FORMATTER_OUTPUT = `TS2322: Type '"1"' is not assignable to type 'number'.`;
  const CUSTOM_FORMATTER_OUTPUT = `TS2322: Type '"1"' is not assignable to type 'number'. at line 1`;
  const CODEFRAME_FORMATTER_OUTPUT = [
    BASIC_FORMATTER_OUTPUT,
    '  > 1 | const foo: number = "1";',
    '      |       ^^^',
    '    2 | const bar = 1;',
    '    3 |',
    '    4 | function baz() {',
  ].join(os.EOL);
  const CUSTOM_CODEFRAME_FORMATTER_OUTPUT = [
    BASIC_FORMATTER_OUTPUT,
    '  > 1 | const foo: number = "1";',
    '      |       ^^^',
    '    2 | const bar = 1;',
  ].join(os.EOL);

  it.each([
    [undefined, CODEFRAME_FORMATTER_OUTPUT, 'relative'],
    ['basic', BASIC_FORMATTER_OUTPUT, 'relative'],
    [customFormatter, CUSTOM_FORMATTER_OUTPUT, 'relative'],
    ['codeframe', CODEFRAME_FORMATTER_OUTPUT, 'relative'],
    [{ type: 'basic' }, BASIC_FORMATTER_OUTPUT, 'relative'],
    [{ type: 'codeframe' }, CODEFRAME_FORMATTER_OUTPUT, 'relative'],
    [
      { type: 'codeframe', options: { linesBelow: 1 } },
      CUSTOM_CODEFRAME_FORMATTER_OUTPUT,
      'relative',
    ],
    [{ type: 'basic', pathType: 'relative' }, BASIC_FORMATTER_OUTPUT, 'relative'],
    [{ type: 'basic', pathType: 'absolute' }, BASIC_FORMATTER_OUTPUT, 'absolute'],
    [{ type: 'codeframe', pathType: 'absolute' }, CODEFRAME_FORMATTER_OUTPUT, 'absolute'],
  ])('creates configuration from options', (options, expectedFormat, expectedPathType) => {
    const formatter = createFormatterConfig(options as FormatterOptions);

    expect(formatter.format(issue)).toEqual(expectedFormat);
    expect(formatter.pathType).toEqual(expectedPathType);
  });
});
