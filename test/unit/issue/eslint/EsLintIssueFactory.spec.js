const {
  createIssuesFromEsLintReports
} = require('../../../../lib/issue/eslint/EsLintIssueFactory');

describe('[UNIT] issue/eslint/EsLintIssueFactory', () => {
  const ES_LINT_MESSAGE_ERROR = {
    column: 0,
    line: 13,
    endColumn: 5,
    endLine: 13,
    ruleId: 'no-unused-vars',
    message: `'y' is assigned a value but never used.`,
    nodeType: '',
    severity: 0
  };
  const ES_LINT_MESSAGE_WARNING = {
    column: 10,
    line: 15,
    message: `'y' is assigned a value but never used.`,
    nodeType: '',
    severity: 1
  };
  const ES_LINT_RESULT_INDEX = {
    filePath: 'src/index.ts',
    messages: [ES_LINT_MESSAGE_ERROR],
    errorCount: 1,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0
  };
  const ES_LINT_RESULT_ANOTHER = {
    filePath: 'src/another.ts',
    messages: [ES_LINT_MESSAGE_WARNING],
    errorCount: 0,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 0
  };
  const ES_LINT_RESULT_ADDITIONAL = {
    filePath: 'src/additional.ts',
    messages: [ES_LINT_MESSAGE_ERROR],
    errorCount: 1,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0
  };
  const ES_LINT_REPORT_A = {
    results: [ES_LINT_RESULT_INDEX, ES_LINT_RESULT_ANOTHER],
    errorCount: 1,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 0
  };
  const ES_LINT_REPORT_B = {
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
