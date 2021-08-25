import type * as ts from 'typescript';
import * as os from 'os';
import { deduplicateAndSortIssues, Issue, IssueLocation } from '../../issue';

function createIssueFromTsDiagnostic(typescript: typeof ts, diagnostic: ts.Diagnostic): Issue {
  let file: string | undefined;
  let location: IssueLocation | undefined;

  if (diagnostic.file) {
    file = diagnostic.file.fileName;

    if (diagnostic.start && diagnostic.length) {
      const {
        line: startLine,
        character: startCharacter,
      } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const {
        line: endLine,
        character: endCharacter,
      } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start + diagnostic.length);

      location = {
        start: {
          line: startLine + 1,
          column: startCharacter + 1,
        },
        end: {
          line: endLine + 1,
          column: endCharacter + 1,
        },
      };
    }
  }

  return {
    code: 'TS' + String(diagnostic.code),
    // we don't handle Suggestion and Message diagnostics
    severity: diagnostic.category === 0 ? 'warning' : 'error',
    message: typescript.flattenDiagnosticMessageText(diagnostic.messageText, os.EOL),
    file,
    location,
  };
}

function createIssuesFromTsDiagnostics(
  typescript: typeof ts,
  diagnostics: ts.Diagnostic[]
): Issue[] {
  return deduplicateAndSortIssues(
    diagnostics.map((diagnostic) => createIssueFromTsDiagnostic(typescript, diagnostic))
  );
}

export { createIssuesFromTsDiagnostics };
