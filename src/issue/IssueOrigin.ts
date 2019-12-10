const IssueOrigin = {
  TYPESCRIPT: 'typescript',
  TSLINT: 'tslint',
  ESLINT: 'eslint',
  INTERNAL: 'internal'
} as const;
type IssueOrigin = typeof IssueOrigin[keyof typeof IssueOrigin];

function isIssueOrigin(value: unknown): value is IssueOrigin {
  return [
    IssueOrigin.TYPESCRIPT,
    IssueOrigin.TSLINT,
    IssueOrigin.ESLINT,
    IssueOrigin.INTERNAL
  ].includes(value as IssueOrigin);
}

function compareIssueOrigins(originA: IssueOrigin, originB: IssueOrigin) {
  const [priorityA, priorityB] = [originA, originB].map(origin =>
    [
      IssueOrigin.TSLINT /* 0 */,
      IssueOrigin.ESLINT /* 1 */,
      IssueOrigin.TYPESCRIPT /* 2 */,
      IssueOrigin.INTERNAL /* 3 */
    ].indexOf(origin)
  );

  return Math.sign(priorityB - priorityA);
}

export { IssueOrigin, isIssueOrigin, compareIssueOrigins };
