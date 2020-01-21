import { createIssuesFromEsLintReports } from '../../../../lib/issue';
import {
  LintMessage,
  LintReport,
  LintResult
} from '../../../../lib/types/eslint';

describe('[UNIT] issue/eslint/EsLintIssueFactory', () => {
  const ES_LINT_MESSAGE_ERROR: LintMessage = {
    column: 0,
    line: 13,
    endColumn: 5,
    endLine: 13,
    ruleId: 'no-unused-vars',
    message: `'y' is assigned a value but never used.`,
    nodeType: '',
    severity: 0,
    source: null
  };
  const ES_LINT_MESSAGE_WARNING: LintMessage = {
    column: 10,
    line: 15,
    ruleId: 'no-unused-vars',
    message: `'y' is assigned a value but never used.`,
    nodeType: '',
    severity: 1,
    source: null
  };
  const ES_LINT_RESULT_INDEX: LintResult = {
    filePath: 'src/index.ts',
    messages: [ES_LINT_MESSAGE_ERROR],
    errorCount: 1,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0
  };
  const ES_LINT_RESULT_ANOTHER: LintResult = {
    filePath: 'src/another.ts',
    messages: [ES_LINT_MESSAGE_WARNING],
    errorCount: 0,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 0
  };
  const ES_LINT_RESULT_ADDITIONAL: LintResult = {
    filePath: 'src/additional.ts',
    messages: [ES_LINT_MESSAGE_ERROR],
    errorCount: 1,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0
  };
  const ES_LINT_REPORT_A: LintReport = {
    results: [ES_LINT_RESULT_INDEX, ES_LINT_RESULT_ANOTHER],
    errorCount: 1,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 0
  };
  const ES_LINT_REPORT_B: LintReport = {
    results: [ES_LINT_RESULT_ADDITIONAL],
    errorCount: 1,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 0
  };
  const ES_LINT_REPORTS = [ES_LINT_REPORT_A, ES_LINT_REPORT_B];

  it.each([[ES_LINT_REPORTS]])(
    'creates Issues from EsLint Reports: %p',
    reports => {
      const issues = createIssuesFromEsLintReports(reports);

      expect(issues).toMatchSnapshot();
    }
  );
});
