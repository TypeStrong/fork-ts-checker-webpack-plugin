import { Issue } from 'lib/issue';
import { createBasicFormatter } from 'lib/formatter';

describe('formatter/BasicFormatter', () => {
  it.each([
    [
      {
        origin: 'typescript',
        severity: 'error',
        code: 'TS2322',
        message: `Type '"1"' is not assignable to type 'number'.`,
        file: 'src/index.ts',
        location: {
          start: {
            line: 10,
            column: 4,
          },
          end: {
            line: 10,
            column: 6,
          },
        },
      },
      `TS2322: Type '"1"' is not assignable to type 'number'.`,
    ],
    [
      {
        origin: 'eslint',
        severity: 'warning',
        code: 'no-unused-vars',
        message: `'x' is assigned a value but never used.`,
        file: 'src/index.ts',
        location: {
          start: {
            line: 12,
            column: 8,
          },
          end: {
            line: 12,
            column: 9,
          },
        },
      },
      `no-unused-vars: 'x' is assigned a value but never used.`,
    ],
  ])('formats issue message "%p" to "%p"', (...args) => {
    const [issue, expectedFormatted] = args as [Issue, string];
    const formatter = createBasicFormatter();
    const formatted = formatter(issue);

    expect(formatted).toEqual(expectedFormatted);
  });
});
