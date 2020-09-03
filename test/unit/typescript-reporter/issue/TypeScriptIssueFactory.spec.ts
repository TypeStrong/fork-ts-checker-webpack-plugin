import * as ts from 'typescript';
import { createIssuesFromTsDiagnostics } from 'lib/typescript-reporter/issue/TypeScriptIssueFactory';

describe('typescript-reporter/issue/TypeScriptIssueFactory', () => {
  const TS_DIAGNOSTIC_WARNING = {
    start: 100,
    code: 4221,
    category: 1,
    messageText: 'Cannot assign string to the number type',
    length: 5,
    file: {
      fileName: 'src/test.ts',
      getLineAndCharacterOfPosition: (position: number) => ({
        line: 2,
        character: 2 + Math.max(0, position - 100),
      }),
    },
  };
  const TS_DIAGNOSTIC_ERROR = {
    start: 12,
    code: 1221,
    category: 0,
    messageText: 'Cannot assign object to the string type',
    length: 1,
    file: {
      fileName: 'src/index.ts',
      getLineAndCharacterOfPosition: (position: number) => ({
        line: 5 + Math.max(0, position - 12),
        character: 10 + Math.max(0, position - 12),
      }),
    },
  };
  const TS_DIAGNOSTIC_WITHOUT_FILE = {
    start: 12,
    code: 1221,
    category: 0,
    length: 4,
    messageText: 'Cannot assign object to the string type',
    file: undefined,
  };

  it.each([[[TS_DIAGNOSTIC_WARNING, TS_DIAGNOSTIC_ERROR, TS_DIAGNOSTIC_WITHOUT_FILE]]])(
    'creates Issues from TsDiagnostics: %p',
    (tsDiagnostics) => {
      const issues = createIssuesFromTsDiagnostics(ts, tsDiagnostics as ts.Diagnostic[]);

      expect(issues).toMatchSnapshot();
    }
  );
});
