import { isIssue, deduplicateAndSortIssues, Issue } from 'lib/issue';

function omit<TObject extends object>(object: TObject, keys: (keyof TObject)[]) {
  const omittedObject = Object.assign({}, object);
  keys.forEach((key) => delete omittedObject[key]);

  return omittedObject;
}

describe('issue/Issue', () => {
  const BASIC_TYPESCRIPT_ISSUE = {
    origin: 'typescript',
    severity: 'error',
    code: 'TS4221',
    message: 'Cannot assign string to the number type',
  };
  const BASIC_ESLINT_ISSUE = {
    origin: 'eslint',
    severity: 'error',
    code: 'white-space',
    message: 'Missing space between function brackets',
  };

  it.each([BASIC_TYPESCRIPT_ISSUE, BASIC_ESLINT_ISSUE])("checks if '%p' is a Issue", (issue) => {
    expect(isIssue(issue)).toEqual(true);
  });

  it.each([
    null,
    undefined,
    '',
    'test',
    1,
    {},
    new Date(),
    true,
    false,
    omit(BASIC_TYPESCRIPT_ISSUE, ['severity']),
    omit(BASIC_ESLINT_ISSUE, ['code']),
    omit(BASIC_TYPESCRIPT_ISSUE, ['origin', 'message']),
  ])("checks if '%p' isn't a Issue", (issue) => {
    expect(isIssue(issue)).toEqual(false);
  });

  it.each([
    [
      // compare origin
      [BASIC_ESLINT_ISSUE, BASIC_TYPESCRIPT_ISSUE, BASIC_ESLINT_ISSUE, BASIC_ESLINT_ISSUE],
      [BASIC_ESLINT_ISSUE, BASIC_TYPESCRIPT_ISSUE],
    ],
    [
      // compare file
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          file: 'src/index.ts',
        },
        BASIC_TYPESCRIPT_ISSUE,
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          file: 'src/different.ts',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          file: 'src/another.ts',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          file: 'src/different.ts',
        },
      ],
      [
        BASIC_TYPESCRIPT_ISSUE,
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          file: 'src/another.ts',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          file: 'src/different.ts',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          file: 'src/index.ts',
        },
      ],
    ],
    [
      // compare severity
      [
        {
          ...BASIC_ESLINT_ISSUE,
          severity: 'warning',
        },
        {
          ...BASIC_ESLINT_ISSUE,
          severity: 'error',
        },
        {
          ...BASIC_ESLINT_ISSUE,
          severity: 'warning',
        },
      ],
      [
        {
          ...BASIC_ESLINT_ISSUE,
          severity: 'error',
        },
        {
          ...BASIC_ESLINT_ISSUE,
          severity: 'warning',
        },
      ],
    ],
    [
      // compare location
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          location: {
            start: {
              line: 10,
              column: 3,
            },
            end: {
              line: 10,
              column: 5,
            },
          },
        },
        BASIC_TYPESCRIPT_ISSUE,
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          location: {
            start: {
              line: 10,
              column: 6,
            },
            end: {
              line: 10,
              column: 9,
            },
          },
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          location: {
            start: {
              line: 10,
              column: 6,
            },
            end: {
              line: 10,
              column: 7,
            },
          },
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          location: {
            start: {
              line: 9,
              column: 6,
            },
            end: {
              line: 10,
              column: 7,
            },
          },
        },
      ],
      [
        BASIC_TYPESCRIPT_ISSUE,
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          location: {
            start: {
              line: 9,
              column: 6,
            },
            end: {
              line: 10,
              column: 7,
            },
          },
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          location: {
            start: {
              line: 10,
              column: 3,
            },
            end: {
              line: 10,
              column: 5,
            },
          },
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          location: {
            start: {
              line: 10,
              column: 6,
            },
            end: {
              line: 10,
              column: 7,
            },
          },
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          location: {
            start: {
              line: 10,
              column: 6,
            },
            end: {
              line: 10,
              column: 9,
            },
          },
        },
      ],
    ],
    [
      // compare code
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: 'TS1500',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: 'TS1000',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: 'TS2000',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: 'TS1000',
        },
      ],
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: 'TS1000',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: 'TS1500',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: 'TS2000',
        },
      ],
    ],
    [
      // compare message
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'B',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'C',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'A',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'B',
        },
      ],
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'A',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'B',
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'C',
        },
      ],
    ],
    [
      // empty
      [],
      [],
    ],
    [
      [BASIC_ESLINT_ISSUE, omit(BASIC_ESLINT_ISSUE, ['message']), BASIC_ESLINT_ISSUE],
      [BASIC_ESLINT_ISSUE],
    ],
    [[omit(BASIC_ESLINT_ISSUE, ['message'])], []],
  ])('deduplicates issues %p to %p', (...args) => {
    const [issues, deduplicatedIssues] = args as [Issue[], Issue[]];
    expect(deduplicateAndSortIssues(issues)).toEqual(deduplicatedIssues);
  });
});
