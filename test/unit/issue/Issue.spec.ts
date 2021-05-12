import { isIssue, deduplicateAndSortIssues, Issue } from 'lib/issue';

function omit<TObject extends object>(object: TObject, keys: (keyof TObject)[]) {
  const omittedObject = Object.assign({}, object);
  keys.forEach((key) => delete omittedObject[key]);

  return omittedObject;
}

describe('issue/Issue', () => {
  const BASIC_ISSUE = {
    severity: 'error',
    code: 'TS4221',
    message: 'Cannot assign string to the number type',
  };

  it.each([BASIC_ISSUE])("checks if '%p' is a Issue", (issue) => {
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
    omit(BASIC_ISSUE, ['severity']),
    omit(BASIC_ISSUE, ['message']),
  ])("checks if '%p' isn't a Issue", (issue) => {
    expect(isIssue(issue)).toEqual(false);
  });

  it.each([
    [
      // compare file
      [
        {
          ...BASIC_ISSUE,
          file: 'src/index.ts',
        },
        BASIC_ISSUE,
        {
          ...BASIC_ISSUE,
          file: 'src/different.ts',
        },
        {
          ...BASIC_ISSUE,
          file: 'src/another.ts',
        },
        {
          ...BASIC_ISSUE,
          file: 'src/different.ts',
        },
      ],
      [
        BASIC_ISSUE,
        {
          ...BASIC_ISSUE,
          file: 'src/another.ts',
        },
        {
          ...BASIC_ISSUE,
          file: 'src/different.ts',
        },
        {
          ...BASIC_ISSUE,
          file: 'src/index.ts',
        },
      ],
    ],
    [
      // compare severity
      [
        {
          ...BASIC_ISSUE,
          severity: 'warning',
        },
        {
          ...BASIC_ISSUE,
          severity: 'error',
        },
        {
          ...BASIC_ISSUE,
          severity: 'warning',
        },
      ],
      [
        {
          ...BASIC_ISSUE,
          severity: 'error',
        },
        {
          ...BASIC_ISSUE,
          severity: 'warning',
        },
      ],
    ],
    [
      // compare location
      [
        {
          ...BASIC_ISSUE,
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
        BASIC_ISSUE,
        {
          ...BASIC_ISSUE,
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
          ...BASIC_ISSUE,
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
          ...BASIC_ISSUE,
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
        BASIC_ISSUE,
        {
          ...BASIC_ISSUE,
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
          ...BASIC_ISSUE,
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
          ...BASIC_ISSUE,
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
          ...BASIC_ISSUE,
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
          ...BASIC_ISSUE,
          code: 'TS1500',
        },
        {
          ...BASIC_ISSUE,
          code: 'TS1000',
        },
        {
          ...BASIC_ISSUE,
          code: 'TS2000',
        },
        {
          ...BASIC_ISSUE,
          code: 'TS1000',
        },
      ],
      [
        {
          ...BASIC_ISSUE,
          code: 'TS1000',
        },
        {
          ...BASIC_ISSUE,
          code: 'TS1500',
        },
        {
          ...BASIC_ISSUE,
          code: 'TS2000',
        },
      ],
    ],
    [
      // compare message
      [
        {
          ...BASIC_ISSUE,
          message: 'B',
        },
        {
          ...BASIC_ISSUE,
          message: 'C',
        },
        {
          ...BASIC_ISSUE,
          message: 'A',
        },
        {
          ...BASIC_ISSUE,
          message: 'B',
        },
      ],
      [
        {
          ...BASIC_ISSUE,
          message: 'A',
        },
        {
          ...BASIC_ISSUE,
          message: 'B',
        },
        {
          ...BASIC_ISSUE,
          message: 'C',
        },
      ],
    ],
    [
      // empty
      [],
      [],
    ],
    [[BASIC_ISSUE, omit(BASIC_ISSUE, ['message']), BASIC_ISSUE], [BASIC_ISSUE]],
    [[omit(BASIC_ISSUE, ['message'])], []],
  ])('deduplicates issues %p to %p', (...args) => {
    const [issues, deduplicatedIssues] = args as [Issue[], Issue[]];
    expect(deduplicateAndSortIssues(issues)).toEqual(deduplicatedIssues);
  });
});
