const os = require('os');
const mockFs = require('mock-fs');
const { IssueOrigin, IssueSeverity } = require('../../../lib/issue');
const {
  createCodeframeFormatter
} = require('../../../lib/formatter/CodeframeFormatter');

describe('[UNIT] formatter/CodeframeFormatter', () => {
  beforeEach(() => {
    mockFs({
      src: {
        'index.ts': [
          'const y: number = "1";',
          'const x = 1;',
          '',
          'function z() {',
          '  console.log(y);',
          '}'
        ].join('\n')
      }
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it.each([
    [
      {
        origin: IssueOrigin.TYPESCRIPT,
        severity: IssueSeverity.ERROR,
        code: '2322',
        message: `Type '"1"' is not assignable to type 'number'.`,
        file: 'src/index.ts',
        line: 1,
        character: 7
      },
      [
        `ERROR in src/index.ts(1,7):`,
        `1:7 Type '"1"' is not assignable to type 'number'.`,
        '  > 1 | const y: number = "1";',
        '      |       ^',
        '    2 | const x = 1;'
      ].join(os.EOL)
    ],
    [
      {
        origin: IssueOrigin.TYPESCRIPT,
        severity: IssueSeverity.ERROR,
        code: '2322',
        message: `Type '"1"' is not assignable to type 'number'.`,
        file: 'src/not-existing.ts',
        line: 1,
        character: 7
      },
      [
        `ERROR in src/not-existing.ts(1,7):`,
        `1:7 Type '"1"' is not assignable to type 'number'.`
      ].join(os.EOL)
    ],
    [
      {
        origin: IssueOrigin.ESLINT,
        severity: IssueSeverity.WARNING,
        code: 'no-unused-vars',
        message: `'x' is assigned a value but never used.`,
        file: 'src/index.ts',
        line: 2,
        character: 7
      },
      [
        `WARNING in src/index.ts(2,7):`,
        `2:7 'x' is assigned a value but never used.`,
        '    1 | const y: number = "1";',
        '  > 2 | const x = 1;',
        '      |       ^',
        '    3 | '
      ].join(os.EOL)
    ],
    [
      {
        origin: IssueOrigin.INTERNAL,
        severity: IssueSeverity.ERROR,
        code: 'INTERNAL',
        message: `Stack overflow - out of memory`
      },
      'INTERNAL ERROR: Stack overflow - out of memory'
    ]
  ])('formats issue message "%p" to "%p"', (issue, expectedFormatted) => {
    const formatter = createCodeframeFormatter({
      linesAbove: 1,
      linesBelow: 1
    });
    const formatted = formatter(issue);

    expect(formatted).toEqual(expectedFormatted);
  });
});
