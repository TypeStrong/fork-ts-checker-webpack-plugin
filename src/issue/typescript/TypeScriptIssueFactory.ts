// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // import for types alone
import { deduplicateAndSortIssues, Issue } from '../Issue';
import { IssueOrigin } from '../IssueOrigin';
import { IssueSeverity } from '../IssueSeverity';

/**
 * Based on the TypeScript source - not used directly from the `typescript`
 * package as there is an option to pass a custom TypeScript instance.
 */
function flattenDiagnosticMessageText(
  messageText: string | ts.DiagnosticMessageChain
) {
  if (typeof messageText === 'string') {
    return messageText;
  } else {
    let diagnosticChain: ts.DiagnosticMessageChain | undefined = messageText;
    let flattenMessageText = '';
    let indent = 0;

    while (diagnosticChain) {
      if (indent) {
        flattenMessageText += '\n';
        for (let i = 0; i < indent; i++) {
          flattenMessageText += '  ';
        }
      }

      flattenMessageText += diagnosticChain.messageText;
      indent++;
      diagnosticChain = diagnosticChain.next;
    }

    return flattenMessageText;
  }
}

function createIssueFromTsDiagnostic(diagnostic: ts.Diagnostic): Issue {
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
    message: flattenDiagnosticMessageText(diagnostic.messageText),
    file,
    line,
    character
  };
}

function createIssuesFromTsDiagnostics(diagnostic: ts.Diagnostic[]): Issue[] {
  return deduplicateAndSortIssues(diagnostic.map(createIssueFromTsDiagnostic));
}

export { createIssueFromTsDiagnostic, createIssuesFromTsDiagnostics };
