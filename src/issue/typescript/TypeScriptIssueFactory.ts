import * as ts from 'typescript'; // import for types alone
import { deduplicateAndSortIssues, Issue } from '../Issue';
import { IssueOrigin } from '../IssueOrigin';
import { IssueSeverity } from '../IssueSeverity';

function createIssueFromTsDiagnostic(
  diagnostic: ts.Diagnostic,
  typescript: typeof ts
): Issue {
  let file: string | undefined;
  let line: number | undefined;
  let character: number | undefined;

  if (diagnostic.file) {
    file = diagnostic.file.fileName;

    if (diagnostic.start) {
      const position = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start
      );
      line = position.line + 1;
      character = position.character + 1;
    }
  }

  return {
    origin: IssueOrigin.TYPESCRIPT,
    code: String(diagnostic.code),
    // we don't handle Suggestion and Message diagnostics
    severity:
      diagnostic.category === 0 ? IssueSeverity.WARNING : IssueSeverity.ERROR,
    message: typescript.flattenDiagnosticMessageText(
      diagnostic.messageText,
      '\n'
    ),
    file,
    line,
    character
  };
}

function createIssuesFromTsDiagnostics(
  diagnostics: ts.Diagnostic[],
  typescript: typeof ts
): Issue[] {
  function createIssueFromTsDiagnosticWithFormatter(diagnostic: ts.Diagnostic) {
    return createIssueFromTsDiagnostic(diagnostic, typescript);
  }
  return deduplicateAndSortIssues(
    diagnostics.map(createIssueFromTsDiagnosticWithFormatter)
  );
}

export { createIssueFromTsDiagnostic, createIssuesFromTsDiagnostics };
