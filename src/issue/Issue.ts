import { IssueSeverity, compareIssueSeverities, isIssueSeverity } from './IssueSeverity';
import { compareIssueLocations, IssueLocation } from './IssueLocation';

interface Issue {
  severity: IssueSeverity;
  code: string;
  message: string;
  file?: string;
  location?: IssueLocation;
}

function isIssue(value: unknown): value is Issue {
  return (
    !!value &&
    typeof value === 'object' &&
    isIssueSeverity((value as Issue).severity) &&
    !!(value as Issue).code &&
    !!(value as Issue).message
  );
}

function compareStrings(stringA?: string, stringB?: string) {
  if (stringA === stringB) {
    return 0;
  }

  if (stringA === undefined || stringA === null) {
    return -1;
  }
  if (stringB === undefined || stringB === null) {
    return 1;
  }

  return stringA.toString().localeCompare(stringB.toString());
}

function compareIssues(issueA: Issue, issueB: Issue) {
  return (
    compareIssueSeverities(issueA.severity, issueB.severity) ||
    compareStrings(issueA.file, issueB.file) ||
    compareIssueLocations(issueA.location, issueB.location) ||
    compareStrings(issueA.code, issueB.code) ||
    compareStrings(issueA.message, issueB.message) ||
    0 /* EqualTo */
  );
}

function equalsIssues(issueA: Issue, issueB: Issue) {
  return compareIssues(issueA, issueB) === 0;
}

function deduplicateAndSortIssues(issues: Issue[]) {
  const sortedIssues = issues.filter(isIssue).sort(compareIssues);

  return sortedIssues.filter(
    (issue, index) => index === 0 || !equalsIssues(issue, sortedIssues[index - 1])
  );
}

export { Issue, isIssue, deduplicateAndSortIssues };
