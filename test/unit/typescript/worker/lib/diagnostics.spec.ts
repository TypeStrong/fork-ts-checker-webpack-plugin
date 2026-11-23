import * as ts from 'typescript';

const source = 'unknownFirst();\nunknownSecond();\n';
const sourceFile = ts.createSourceFile('src/index.ts', source, ts.ScriptTarget.Latest);

function createDiagnostic(start?: number, length?: number): ts.Diagnostic {
  return {
    category: ts.DiagnosticCategory.Error,
    code: 2304,
    file: sourceFile,
    start,
    length,
    messageText: "Cannot find name 'unknownFirst'.",
  };
}

describe('typescript/worker/lib/diagnostics', () => {
  const originalWorkerData = process.env.WORKER_DATA;

  beforeAll(() => {
    process.env.WORKER_DATA = JSON.stringify({ typescriptPath: require.resolve('typescript') });
  });

  afterAll(() => {
    if (originalWorkerData === undefined) {
      delete process.env.WORKER_DATA;
    } else {
      process.env.WORKER_DATA = originalWorkerData;
    }
  });

  it('preserves locations for diagnostics at offset zero and later offsets', async () => {
    const { createIssuesFromDiagnostics } = await import('src/typescript/worker/lib/diagnostics');

    const issues = createIssuesFromDiagnostics([createDiagnostic(0, 12), createDiagnostic(16, 13)]);

    expect(issues).toHaveLength(2);
    expect(issues[0].location).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 13 },
    });
    expect(issues[1].location).toEqual({
      start: { line: 2, column: 1 },
      end: { line: 2, column: 14 },
    });
  });

  it('omits locations when the diagnostic position is incomplete', async () => {
    const { createIssuesFromDiagnostics } = await import('src/typescript/worker/lib/diagnostics');

    const issues = createIssuesFromDiagnostics([
      createDiagnostic(undefined, 12),
      createDiagnostic(0, undefined),
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0].location).toBeUndefined();
  });
});
