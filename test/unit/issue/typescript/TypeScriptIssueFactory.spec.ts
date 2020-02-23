import {
  createIssueFromTsDiagnostic,
  createIssuesFromTsDiagnostics
} from '../../../../lib/issue';
import * as ts from 'typescript';

function makeDiagnosticMessageChainTestCase(): ts.Diagnostic {
  const version: number = Number.parseFloat(ts.versionMajorMinor);
  if (version <= 3.5) {
    return ({
      start: 12,
      code: 1221,
      category: 0,
      length: 3,
      file: undefined,
      messageText: {
        messageText: 'Cannot assign object to the string type',
        category: 0,
        code: 1221,
        next: {
          messageText: 'Another ident message',
          category: 0,
          code: 1221,
          next: {
            messageText: 'The most ident message',
            category: 0,
            code: 1221
          }
        }
      }
    } as unknown) as ts.Diagnostic;
  } else {
    // newer versions of typescript have the |next| property as an array
    return ({
      start: 12,
      code: 1221,
      category: 0,
      length: 3,
      file: undefined,
      messageText: {
        messageText: 'Cannot assign object to the string type',
        category: 0,
        code: 1221,
        next: [
          {
            messageText: 'Another ident message',
            category: 0,
            code: 1221,
            next: [
              {
                messageText: 'The most ident message',
                category: 0,
                code: 1221
              }
            ]
          }
        ]
      }
    } as unknown) as ts.Diagnostic;
  }
}

describe('[UNIT] issue/typescript/TypeScriptIssueFactory', () => {
  const TS_DIAGNOSTIC_WARNING: ts.Diagnostic = {
    start: 100,
    code: 4221,
    category: 1,
    messageText: 'Cannot assign string to the number type',
    length: 1,
    file: {
      fileName: 'src/test.ts',
      getLineAndCharacterOfPosition: () => ({
        line: 2,
        character: 2
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  };
  const TS_DIAGNOSTIC_ERROR: ts.Diagnostic = {
    start: 12,
    code: 1221,
    category: 0,
    messageText: 'Cannot assign object to the string type',
    length: 1,
    file: {
      fileName: 'src/index.ts',
      getLineAndCharacterOfPosition: () => ({
        line: 5,
        character: 10
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  };
  const TS_DIAGNOSTIC_WITHOUT_FILE: ts.Diagnostic = {
    start: 12,
    code: 1221,
    category: 0,
    length: 1,
    messageText: 'Cannot assign object to the string type',
    file: undefined
  };
  const TS_DIAGNOSTIC_MESSAGE_CHAIN: ts.Diagnostic = makeDiagnosticMessageChainTestCase();

  it.each([
    [TS_DIAGNOSTIC_WARNING],
    [TS_DIAGNOSTIC_ERROR],
    [TS_DIAGNOSTIC_WITHOUT_FILE],
    [TS_DIAGNOSTIC_MESSAGE_CHAIN]
  ])('creates Issue from TsDiagnostic: %p', tsDiagnostic => {
    const issue = createIssueFromTsDiagnostic(tsDiagnostic, ts);

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
    const issues = createIssuesFromTsDiagnostics(tsDiagnostics, ts);

    expect(issues).toMatchSnapshot();
  });
});
