import type { IssuePosition } from './issue-position';
import { compareIssuePositions } from './issue-position';

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

function formatIssueLocation(location: IssueLocation) {
  return `${location.start.line}:${location.start.column}`;
}

export { IssueLocation, compareIssueLocations, formatIssueLocation };
