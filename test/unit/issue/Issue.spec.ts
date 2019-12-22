import {
  IssueSeverity,
  IssueOrigin,
  isIssue,
  deduplicateAndSortIssues,
  Issue
} from '../../../lib/issue';

function omit<TObject extends object>(
  object: TObject,
  keys: (keyof TObject)[]
) {
  const omittedObject = Object.assign({}, object);
  keys.forEach(key => delete omittedObject[key]);

  return omittedObject;
}

describe('[UNIT] issue/Issue', () => {
  const BASIC_INTERNAL_ISSUE = {
    origin: IssueOrigin.INTERNAL,
    severity: IssueSeverity.ERROR,
    code: 'INTERNAL',
    message: 'Out of memory'
  };
  const BASIC_TYPESCRIPT_ISSUE = {
    origin: IssueOrigin.TYPESCRIPT,
    severity: IssueSeverity.ERROR,
    code: '4221',
    message: 'Cannot assign string to the number type'
  };
  const BASIC_ESLINT_ISSUE = {
    origin: IssueOrigin.ESLINT,
    severity: IssueSeverity.ERROR,
    code: 'white-space',
    message: 'Missing space between function brackets'
  };

  it.each([BASIC_INTERNAL_ISSUE, BASIC_TYPESCRIPT_ISSUE, BASIC_ESLINT_ISSUE])(
    "checks if '%p' is a Issue",
    issue => {
      expect(isIssue(issue)).toEqual(true);
    }
  );

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
    omit(BASIC_INTERNAL_ISSUE, ['origin']),
    omit(BASIC_TYPESCRIPT_ISSUE, ['severity']),
    omit(BASIC_ESLINT_ISSUE, ['code']),
    omit(BASIC_TYPESCRIPT_ISSUE, ['origin', 'message'])
  ])("checks if '%p' isn't a Issue", issue => {
    expect(isIssue(issue)).toEqual(false);
  });

  it.each([
    [
      // compare origin
      [
        BASIC_ESLINT_ISSUE,
        BASIC_TYPESCRIPT_ISSUE,
        BASIC_ESLINT_ISSUE,
        BASIC_INTERNAL_ISSUE,
        BASIC_INTERNAL_ISSUE,
        BASIC_ESLINT_ISSUE
      ],
      [BASIC_INTERNAL_ISSUE, BASIC_TYPESCRIPT_ISSUE, BASIC_ESLINT_ISSUE]
    ],
    [
      // compare file
      [
        {
          ...BASIC_INTERNAL_ISSUE,
          file: 'src/index.ts'
        },
        BASIC_INTERNAL_ISSUE,
        {
          ...BASIC_INTERNAL_ISSUE,
          file: 'src/different.ts'
        },
        {
          ...BASIC_INTERNAL_ISSUE,
          file: 'src/another.ts'
        },
        {
          ...BASIC_INTERNAL_ISSUE,
          file: 'src/different.ts'
        }
      ],
      [
        BASIC_INTERNAL_ISSUE,
        {
          ...BASIC_INTERNAL_ISSUE,
          file: 'src/another.ts'
        },
        {
          ...BASIC_INTERNAL_ISSUE,
          file: 'src/different.ts'
        },
        {
          ...BASIC_INTERNAL_ISSUE,
          file: 'src/index.ts'
        }
      ]
    ],
    [
      // compare severity
      [
        {
          ...BASIC_ESLINT_ISSUE,
          severity: IssueSeverity.WARNING
        },
        {
          ...BASIC_ESLINT_ISSUE,
          severity: IssueSeverity.ERROR
        },
        {
          ...BASIC_ESLINT_ISSUE,
          severity: IssueSeverity.WARNING
        }
      ],
      [
        {
          ...BASIC_ESLINT_ISSUE,
          severity: IssueSeverity.ERROR
        },
        {
          ...BASIC_ESLINT_ISSUE,
          severity: IssueSeverity.WARNING
        }
      ]
    ],
    [
      // compare line
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 15
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 5
        },
        BASIC_TYPESCRIPT_ISSUE,
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10
        }
      ],
      [
        BASIC_TYPESCRIPT_ISSUE,
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 5
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 15
        }
      ]
    ],
    [
      // compare character
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10,
          character: 3
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10,
          character: 6
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10,
          character: 1
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10,
          character: 6
        }
      ],
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10,
          character: 1
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10,
          character: 3
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          line: 10,
          character: 6
        }
      ]
    ],
    [
      // compare code
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: '1500'
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: '1000'
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: '2000'
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: '1000'
        }
      ],
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: '1000'
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: '1500'
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          code: '2000'
        }
      ]
    ],
    [
      // compare message
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'B'
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'C'
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'A'
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'B'
        }
      ],
      [
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'A'
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'B'
        },
        {
          ...BASIC_TYPESCRIPT_ISSUE,
          message: 'C'
        }
      ]
    ],
    [
      // stack
      [
        {
          ...BASIC_INTERNAL_ISSUE,
          stack: 'A'
        },
        {
          ...BASIC_INTERNAL_ISSUE,
          stack: 'C'
        },
        BASIC_INTERNAL_ISSUE,
        {
          ...BASIC_INTERNAL_ISSUE,
          stack: 'A'
        },
        {
          ...BASIC_INTERNAL_ISSUE,
          stack: 'B'
        }
      ],
      [
        BASIC_INTERNAL_ISSUE,
        {
          ...BASIC_INTERNAL_ISSUE,
          stack: 'A'
        },
        {
          ...BASIC_INTERNAL_ISSUE,
          stack: 'B'
        },
        {
          ...BASIC_INTERNAL_ISSUE,
          stack: 'C'
        }
      ]
    ],
    [
      // empty
      [],
      []
    ],
    [
      [
        BASIC_ESLINT_ISSUE,
        omit(BASIC_ESLINT_ISSUE, ['message']),
        BASIC_ESLINT_ISSUE
      ],
      [BASIC_ESLINT_ISSUE]
    ],
    [[omit(BASIC_ESLINT_ISSUE, ['message'])], []]
  ])('deduplicates issues %p to %p', (...args) => {
    const [issues, deduplicatedIssues] = args as [Issue[], Issue[]];
    expect(deduplicateAndSortIssues(issues)).toEqual(deduplicatedIssues);
  });
});
