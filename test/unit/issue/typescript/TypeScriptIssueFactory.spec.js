const {
  createIssueFromTsDiagnostic,
  createIssuesFromTsDiagnostics
} = require('../../../../lib/issue/typescript');

describe('[UNIT] issue/typescript/TypeScriptIssueFactory', () => {
  const TS_DIAGNOSTIC_WARNING = {
    start: 100,
    code: '4221',
    category: 1,
    messageText: 'Cannot assign string to the number type',
    file: {
      fileName: 'src/test.ts',
      getLineAndCharacterOfPosition: () => ({
        line: 2,
        character: 2
      })
    }
  };
  const TS_DIAGNOSTIC_ERROR = {
    start: 12,
    code: '1221',
    category: 0,
    messageText: 'Cannot assign object to the string type',
    file: {
      fileName: 'src/index.ts',
      getLineAndCharacterOfPosition: () => ({
        line: 5,
        character: 10
      })
    }
  };
  const TS_DIAGNOSTIC_WITHOUT_FILE = {
    start: 12,
    code: '1221',
    category: 0,
    messageText: 'Cannot assign object to the string type'
  };
  const TS_DIAGNOSTIC_MESSAGE_CHAIN = {
    start: 12,
    code: '1221',
    category: 0,
    messageText: {
      messageText: 'Cannot assign object to the string type',
      category: 0,
      code: '1221',
      next: {
        messageText: 'Another ident message',
        category: 0,
        code: '1221',
        next: {
          messageText: 'The most ident message',
          category: 0,
          code: '1221'
        }
      }
    }
  };

  it.each([
    [TS_DIAGNOSTIC_WARNING],
    [TS_DIAGNOSTIC_ERROR],
    [TS_DIAGNOSTIC_WITHOUT_FILE],
    [TS_DIAGNOSTIC_MESSAGE_CHAIN]
  ])('creates Issue from TsDiagnostic: %p', tsDiagnostic => {
    const issue = createIssueFromTsDiagnostic(tsDiagnostic);

    expect(issue).toMatchSnapshot();
  });

  it.each([
    [
      [
        TS_DIAGNOSTIC_WARNING,
        TS_DIAGNOSTIC_ERROR,
        TS_DIAGNOSTIC_WITHOUT_FILE,
        TS_DIAGNOSTIC_MESSAGE_CHAIN
      ]
    ]
  ])('creates Issues from TsDiagnostics: %p', tsDiagnostics => {
    const issues = createIssuesFromTsDiagnostics(tsDiagnostics);

    expect(issues).toMatchSnapshot();
  });
});
