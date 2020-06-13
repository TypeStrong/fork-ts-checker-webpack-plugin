import { Issue, IssueLocation } from '../../issue';
import { LintMessage, LintResult } from '../types/eslint';

function createIssueFromEsLintMessage(filePath: string, message: LintMessage): Issue {
  let location: IssueLocation | undefined;

  if (message.line) {
    location = {
      start: {
        line: message.line,
        column: message.column,
      },
      end: {
        line: message.endLine || message.line,
        column: message.endColumn || message.column,
      },
    };
  }

  return {
    origin: 'eslint',
    code: message.ruleId ? String(message.ruleId) : '[unknown]',
    severity: message.severity === 1 ? 'warning' : 'error',
    message: message.message,
    file: filePath,
    location,
  };
}

function createIssuesFromEsLintResults(results: LintResult[]): Issue[] {
  return results.reduce<Issue[]>(
    (messages, result) => [
      ...messages,
      ...result.messages.map((message) => createIssueFromEsLintMessage(result.filePath, message)),
    ],
    []
  );
}

export { createIssuesFromEsLintResults };
