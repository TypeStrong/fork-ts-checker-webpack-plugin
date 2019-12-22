import * as os from 'os';
import { Issue, IssueOrigin, IssueSeverity } from '../../../lib/issue';
import { createDefaultFormatter } from '../../../lib/formatter';

describe('[UNIT] formatter/DefaultFormatter', () => {
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
        `TS2322: Type '"1"' is not assignable to type 'number'.`
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
        character: 10
      },
      [
        `WARNING in src/index.ts(2,10):`,
        `no-unused-vars: 'x' is assigned a value but never used.`
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
  ])('formats issue message "%p" to "%p"', (...args) => {
    const [issue, expectedFormatted] = args as [Issue, string];
    const formatter = createDefaultFormatter();
    const formatted = formatter(issue);

    expect(formatted).toEqual(expectedFormatted);
  });
});
