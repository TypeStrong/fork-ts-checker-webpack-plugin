import {
  IssueOrigin,
  isIssueOrigin,
  compareIssueOrigins
} from '../../../lib/issue';

describe('[UNIT] issue/IssueOrigin', () => {
  it('defines issue origin enum', () => {
    expect(IssueOrigin).toMatchSnapshot();
  });

  it.each([IssueOrigin.INTERNAL, IssueOrigin.TYPESCRIPT, IssueOrigin.ESLINT])(
    "checks if '%p' is a IssueOrigin",
    origin => {
      expect(isIssueOrigin(origin)).toEqual(true);
    }
  );

  it.each([null, undefined, '', 'test', 1, {}, new Date(), true, false])(
    "checks if '%p' isn't a IssueOrigin",
    origin => {
      expect(isIssueOrigin(origin)).toEqual(false);
    }
  );

  it.each([
    // INTERNAL
    [IssueOrigin.INTERNAL, IssueOrigin.INTERNAL, 0],
    [IssueOrigin.INTERNAL, IssueOrigin.TYPESCRIPT, -1],
    [IssueOrigin.INTERNAL, IssueOrigin.ESLINT, -1],

    // TYPESCRIPT
    [IssueOrigin.TYPESCRIPT, IssueOrigin.INTERNAL, 1],
    [IssueOrigin.TYPESCRIPT, IssueOrigin.TYPESCRIPT, 0],
    [IssueOrigin.TYPESCRIPT, IssueOrigin.ESLINT, -1],

    // ESLINT
    [IssueOrigin.ESLINT, IssueOrigin.INTERNAL, 1],
    [IssueOrigin.ESLINT, IssueOrigin.TYPESCRIPT, 1],
    [IssueOrigin.ESLINT, IssueOrigin.ESLINT, 0]
  ])("compares issue origin '%p' with '%p' and returns '%p'", (...args) => {
    const [originA, originB, result] = args as [
      IssueOrigin,
      IssueOrigin,
      number
    ];
    expect(compareIssueOrigins(originA, originB)).toEqual(result);
  });
});
