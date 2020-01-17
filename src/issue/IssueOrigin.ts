const IssueOrigin = {
  TYPESCRIPT: 'typescript',
  ESLINT: 'eslint',
  INTERNAL: 'internal'
} as const;
type IssueOrigin = typeof IssueOrigin[keyof typeof IssueOrigin];

function isIssueOrigin(value: unknown): value is IssueOrigin {
  return [
    IssueOrigin.TYPESCRIPT,
    IssueOrigin.ESLINT,
    IssueOrigin.INTERNAL
  ].includes(value as IssueOrigin);
}

function compareIssueOrigins(originA: IssueOrigin, originB: IssueOrigin) {
  const [priorityA, priorityB] = [originA, originB].map(origin =>
    [
      IssueOrigin.ESLINT /* 0 */,
      IssueOrigin.TYPESCRIPT /* 1 */,
      IssueOrigin.INTERNAL /* 2 */
    ].indexOf(origin)
  );

  return Math.sign(priorityB - priorityA);
}

export { IssueOrigin, isIssueOrigin, compareIssueOrigins };
