const {
  IssueOrigin,
  isIssueOrigin,
  compareIssueOrigins
} = require('../../../lib/issue/IssueOrigin');

describe('[UNIT] issue/IssueOrigin', () => {
  it('defines issue origin enum', () => {
    expect(IssueOrigin).toMatchSnapshot();
  });

  it.each([
    IssueOrigin.INTERNAL,
    IssueOrigin.TYPESCRIPT,
    IssueOrigin.ESLINT,
    IssueOrigin.TSLINT
  ])("checks if '%p' is a IssueOrigin", origin => {
    expect(isIssueOrigin(origin)).toEqual(true);
  });

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
    [IssueOrigin.INTERNAL, IssueOrigin.TSLINT, -1],

    // TYPESCRIPT
    [IssueOrigin.TYPESCRIPT, IssueOrigin.INTERNAL, 1],
    [IssueOrigin.TYPESCRIPT, IssueOrigin.TYPESCRIPT, 0],
    [IssueOrigin.TYPESCRIPT, IssueOrigin.ESLINT, -1],
    [IssueOrigin.TYPESCRIPT, IssueOrigin.TSLINT, -1],

    // ESLINT
    [IssueOrigin.ESLINT, IssueOrigin.INTERNAL, 1],
    [IssueOrigin.ESLINT, IssueOrigin.TYPESCRIPT, 1],
    [IssueOrigin.ESLINT, IssueOrigin.ESLINT, 0],
    [IssueOrigin.ESLINT, IssueOrigin.TSLINT, -1],

    // TSLINT
    [IssueOrigin.TSLINT, IssueOrigin.INTERNAL, 1],
    [IssueOrigin.TSLINT, IssueOrigin.TYPESCRIPT, 1],
    [IssueOrigin.TSLINT, IssueOrigin.ESLINT, 1],
    [IssueOrigin.TSLINT, IssueOrigin.TSLINT, 0]
  ])(
    "compares issue origin '%p' with '%p' and returns '%p'",
    (originA, originB, result) => {
      expect(compareIssueOrigins(originA, originB)).toEqual(result);
    }
  );
});
