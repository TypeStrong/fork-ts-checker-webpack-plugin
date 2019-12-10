// tslint:disable-next-line:no-implicit-dependencies
import * as tslint from 'tslint'; // import for types alone
import { deduplicateAndSortIssues, Issue } from '../Issue';
import { IssueOrigin } from '../IssueOrigin';
import { IssueSeverity } from '../IssueSeverity';

function createIssueFromTsLintRuleFailure(failure: tslint.RuleFailure): Issue {
  const position = failure.getStartPosition().getLineAndCharacter();

  return {
    origin: IssueOrigin.TSLINT,
    code: failure.getRuleName(),
    severity:
      failure.getRuleSeverity() === 'warning'
        ? IssueSeverity.WARNING
        : IssueSeverity.ERROR,
    message: failure.getFailure(),
    file: failure.getFileName(),
    line: position.line + 1,
    character: position.character + 1
  };
}

function createIssuesFromTsLintRuleFailures(
  failures: tslint.RuleFailure[]
): Issue[] {
  return deduplicateAndSortIssues(
    failures.map(createIssueFromTsLintRuleFailure)
  );
}

export { createIssueFromTsLintRuleFailure, createIssuesFromTsLintRuleFailures };
