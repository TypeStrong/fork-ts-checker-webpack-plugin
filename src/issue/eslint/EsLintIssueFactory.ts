import { FileAwareEsLintMessage } from './FileAwareEsLintMessage';
import { deduplicateAndSortIssues, Issue } from '../Issue';
import { IssueOrigin } from '../IssueOrigin';
import { IssueSeverity } from '../IssueSeverity';
import { LintReport, LintResult } from '../../types/eslint';

function createIssueFromEsLintMessage(message: FileAwareEsLintMessage): Issue {
  return {
    origin: IssueOrigin.ESLINT,
    code: message.ruleId ? String(message.ruleId) : '[unknown]',
    severity:
      message.severity === 1 ? IssueSeverity.WARNING : IssueSeverity.ERROR,
    message: message.message,
    file: message.filePath,
    line: message.line,
    character: message.column
  };
}

function createFileAwareEsLintMessagesFromEsLintResult(
  result: LintResult
): FileAwareEsLintMessage[] {
  return result.messages.map(message => ({
    ...message,
    filePath: result.filePath
  }));
}

function createFileAwareEsLintMessagesFromEsLintReport(
  report: LintReport
): FileAwareEsLintMessage[] {
  return report.results.reduce<FileAwareEsLintMessage[]>(
    (messages, result) => [
      ...messages,
      ...createFileAwareEsLintMessagesFromEsLintResult(result)
    ],
    []
  );
}

function createFileAwareEsLintMessagesFromEsLintReports(
  reports: LintReport[]
): FileAwareEsLintMessage[] {
  return reports.reduce<FileAwareEsLintMessage[]>(
    (messages, report) => [
      ...messages,
      ...createFileAwareEsLintMessagesFromEsLintReport(report)
    ],
    []
  );
}

function createIssuesFromEsLintMessages(
  messages: FileAwareEsLintMessage[]
): Issue[] {
  return deduplicateAndSortIssues(messages.map(createIssueFromEsLintMessage));
}

function createIssuesFromEsLintReports(reports: LintReport[]): Issue[] {
  return createIssuesFromEsLintMessages(
    createFileAwareEsLintMessagesFromEsLintReports(reports)
  );
}

export { createIssuesFromEsLintReports };
