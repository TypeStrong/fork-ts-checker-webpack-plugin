import { compareIssuePositions, IssuePosition } from './IssuePosition';

interface IssueLocation {
  start: IssuePosition;
  end: IssuePosition;
}

function compareIssueLocations(locationA?: IssueLocation, locationB?: IssueLocation) {
  if (locationA === locationB) {
    return 0;
  }

  if (!locationA) {
    return -1;
  }

  if (!locationB) {
    return 1;
  }

  return (
    compareIssuePositions(locationA.start, locationB.start) ||
    compareIssuePositions(locationA.end, locationB.end)
  );
}

function formatIssueLocation({ start, end }: IssueLocation) {
  if (!end.line || start.line === end.line) {
    // the same line
    if (!end.column || start.column === end.column) {
      // the same column
      return `${start.line}:${start.column}`;
    } else {
      // different column
      return `${start.line}:${start.column}-${end.column}`;
    }
  } else {
    // different lines
    return `${start.line}:${start.column}-${end.line}:${end.column}`;
  }
}

export { IssueLocation, compareIssueLocations, formatIssueLocation };
