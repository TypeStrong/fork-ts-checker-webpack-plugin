import { compareIssuePositions, IssuePosition } from './IssuePosition';

interface IssueLocation {
  start: IssuePosition;
  end: IssuePosition;
}

function compareIssueLocations(locationA?: IssueLocation, locationB?: IssueLocation) {
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

export { IssueLocation, compareIssueLocations };
