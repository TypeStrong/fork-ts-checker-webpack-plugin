const {
  createIssueFromTsLintRuleFailure,
  createIssuesFromTsLintRuleFailures
} = require('../../../../lib/issue/tslint/TsLintIssueFactory');

describe('[UNIT] issue/tslint/TsLintIssueFactory', () => {
  const TS_LINT_RULE_FAILURE_WARNING = {
    getRuleName: () => 'no-unused-vars',
    getRuleSeverity: () => 'warning',
    getFailure: () => `'x' is assigned a value but never used.`,
    getFileName: () => 'src/test.ts',
    getStartPosition: () => ({
      getLineAndCharacter: () => ({
        line: 2,
        character: 2
      })
    })
  };
  const TS_LINT_RULE_FAILURE_ERROR = {
    getRuleName: () => 'no-unused-vars',
    getRuleSeverity: () => 'error',
    getFailure: () => `'y' is assigned a value but never used.`,
    getFileName: () => 'src/index.ts',
    getStartPosition: () => ({
      getLineAndCharacter: () => ({
        line: 10,
        character: 14
      })
    })
  };

  it.each([[TS_LINT_RULE_FAILURE_WARNING], [TS_LINT_RULE_FAILURE_ERROR]])(
    'creates Issue from TsLint RuleFailure: %p',
    ruleFailure => {
      const issue = createIssueFromTsLintRuleFailure(ruleFailure);

      expect(issue).toMatchSnapshot();
    }
  );

  it.each([[[TS_LINT_RULE_FAILURE_WARNING, TS_LINT_RULE_FAILURE_ERROR]]])(
    'creates Issues from TsLint RuleFailures: %p',
    ruleFailures => {
      const issues = createIssuesFromTsLintRuleFailures(ruleFailures);

      expect(issues).toMatchSnapshot();
    }
  );
});
