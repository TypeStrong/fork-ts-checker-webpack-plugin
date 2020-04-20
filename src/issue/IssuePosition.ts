interface IssuePosition {
  line: number;
  column: number;
}

function compareIssuePositions(positionA?: IssuePosition, positionB?: IssuePosition) {
  if (positionA === positionB) {
    return 0;
  }

  if (!positionA) {
    return -1;
  }

  if (!positionB) {
    return 1;
  }

  return (
    Math.sign(positionA.line - positionB.line) || Math.sign(positionA.column - positionB.column)
  );
}

export { IssuePosition, compareIssuePositions };
