import {
  createIssueFromTsDiagnostic,
  createIssuesFromTsDiagnostics
} from '../../../../lib/issue';
import { Diagnostic } from 'typescript';

describe('[UNIT] issue/typescript/TypeScriptIssueFactory', () => {
  const TS_DIAGNOSTIC_WARNING: Diagnostic = {
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
  const TS_DIAGNOSTIC_ERROR: Diagnostic = {
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
  const TS_DIAGNOSTIC_WITHOUT_FILE: Diagnostic = {
    start: 12,
    code: 1221,
    category: 0,
    length: 1,
    messageText: 'Cannot assign object to the string type',
    file: undefined
  };
  // Newer versions of TS have a DiagnosticMessageChain[] for the `next` field
  const TS_DIAGNOSTIC_MESSAGE_CHAIN_ARRAY_NEXT: Diagnostic = {
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
        },
        {
          messageText: 'Sibling message',
          category: 0,
          code: 1221,
          next: [
            {
              messageText: 'Indented sibling message',
              category: 0,
              code: 1221
            }
          ]
        }
      ]
    } as any // Cast required else this will fail on older versions of TS
  };
  // Older versions of TS have a DiagnosticMessageChain for the `next` field
  const TS_DIAGNOSTIC_MESSAGE_CHAIN_NON_ARRAY_NEXT: Diagnostic = {
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
    } as any // Cast required else this will fail on newer versions of TS
  };

  it.each([
    [TS_DIAGNOSTIC_WARNING],
    [TS_DIAGNOSTIC_ERROR],
    [TS_DIAGNOSTIC_WITHOUT_FILE],
    [TS_DIAGNOSTIC_MESSAGE_CHAIN_NON_ARRAY_NEXT],
    [TS_DIAGNOSTIC_MESSAGE_CHAIN_ARRAY_NEXT]
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
        TS_DIAGNOSTIC_MESSAGE_CHAIN_NON_ARRAY_NEXT,
        TS_DIAGNOSTIC_MESSAGE_CHAIN_ARRAY_NEXT
      ]
    ]
  ])('creates Issues from TsDiagnostics: %p', tsDiagnostics => {
    const issues = createIssuesFromTsDiagnostics(tsDiagnostics);

    expect(issues).toMatchSnapshot();
  });
});
