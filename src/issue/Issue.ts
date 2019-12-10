import {
  IssueSeverity,
  compareIssueSeverities,
  isIssueSeverity
} from './IssueSeverity';
import { IssueOrigin, compareIssueOrigins, isIssueOrigin } from './IssueOrigin';

interface Issue {
  origin: IssueOrigin;
  severity: IssueSeverity;
  code: string;
  message: string;
  file?: string;
  line?: number;
  character?: number;
  stack?: string;
}

function isIssue(value: unknown): value is Issue {
  return (
    !!value &&
    typeof value === 'object' &&
    isIssueOrigin((value as Issue).origin) &&
    isIssueSeverity((value as Issue).severity) &&
    !!(value as Issue).code &&
    !!(value as Issue).message
  );
}

function compareOptionalStrings(stringA?: string, stringB?: string) {
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

function compareNumbers(numberA?: number, numberB?: number) {
  if (numberA === numberB) {
    return 0;
  }

  if (numberA === undefined || numberA === null) {
    return -1;
  }
  if (numberB === undefined || numberB === null) {
    return 1;
  }

  return Math.sign(numberA - numberB);
}

function compareIssues(issueA: Issue, issueB: Issue) {
  return (
    compareIssueOrigins(issueA.origin, issueB.origin) ||
    compareOptionalStrings(issueA.file, issueB.file) ||
    compareIssueSeverities(issueA.severity, issueB.severity) ||
    compareNumbers(issueA.line, issueB.line) ||
    compareNumbers(issueA.character, issueB.character) ||
    compareOptionalStrings(issueA.code, issueB.code) ||
    compareOptionalStrings(issueA.message, issueB.message) ||
    compareOptionalStrings(issueA.stack, issueB.stack) ||
    0 /* EqualTo */
  );
}

function equalsIssues(issueA: Issue, issueB: Issue) {
  return compareIssues(issueA, issueB) === 0;
}

function deduplicateAndSortIssues(issues: Issue[]) {
  const sortedIssues = issues.filter(isIssue).sort(compareIssues);

  return sortedIssues.filter(
    (issue, index) =>
      index === 0 || !equalsIssues(issue, sortedIssues[index - 1])
  );
}

export { Issue, isIssue, deduplicateAndSortIssues };
