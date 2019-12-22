import { Issue, IssueOrigin, IssueSeverity } from '../../../lib/issue';
import { createRawFormatter } from '../../../lib/formatter';

describe('[UNIT] formatter/RawFormatter', () => {
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
      `ERROR TS2322: Type '"1"' is not assignable to type 'number'.`
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
      `WARNING no-unused-vars: 'x' is assigned a value but never used.`
    ]
  ])('formats issue message "%p" to "%p"', (...args) => {
    const [issue, expectedFormatted] = args as [Issue, string];
    const formatter = createRawFormatter();
    const formatted = formatter(issue);

    expect(formatted).toEqual(expectedFormatted);
  });
});
