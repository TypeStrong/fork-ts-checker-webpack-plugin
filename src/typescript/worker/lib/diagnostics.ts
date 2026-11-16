import * as os from 'os';

import type * as ts from 'typescript';

import type { Issue, IssueLocation } from '../../../issue';
import { deduplicateAndSortIssues } from '../../../issue';

import { typescript } from './typescript';
import { config } from './worker-config';

const diagnosticsPerConfigFile = new Map<string, ts.Diagnostic[]>();

export function updateDiagnostics(configFile: string, diagnostics: ts.Diagnostic[]): void {
  diagnosticsPerConfigFile.set(configFile, diagnostics);
}

export function getIssues(): Issue[] {
  const allDiagnostics: ts.Diagnostic[] = [];

  diagnosticsPerConfigFile.forEach((diagnostics) => {
    allDiagnostics.push(...diagnostics);
  });

  return createIssuesFromDiagnostics(allDiagnostics);
}

export function invalidateDiagnostics(): void {
  diagnosticsPerConfigFile.clear();
}

/**
 * Options diagnostics contain errors that the user did not cause, so we skip them.
 */
function isReportableOptionsDiagnostic(diagnostic: ts.Diagnostic): boolean {
  if (diagnostic.code === 6053) {
    // File '{0}' not found.
    // A deleted file stays in the list of root files of a watch program until the next update.
    return false;
  }
  return true;
}

export function getDiagnosticsOfProgram(program: ts.Program | ts.BuilderProgram): ts.Diagnostic[] {
  const programDiagnostics: ts.Diagnostic[] = [];
  try {
    // compiler options errors, for example a deprecated or an invalid option, are always reported
    programDiagnostics.push(
      ...program.getOptionsDiagnostics().filter(isReportableOptionsDiagnostic)
    );
    if (config.diagnosticOptions.syntactic) {
      programDiagnostics.push(...program.getSyntacticDiagnostics());
    }
    if (config.diagnosticOptions.global) {
      programDiagnostics.push(...program.getGlobalDiagnostics());
    }
    if (config.diagnosticOptions.semantic) {
      programDiagnostics.push(...program.getSemanticDiagnostics());
    }
    if (config.diagnosticOptions.declaration) {
      programDiagnostics.push(...program.getDeclarationDiagnostics());
    }
  } catch (e) {
    if (e instanceof Error) {
      programDiagnostics.push({
        code: 1,
        category: 1,
        messageText: `TSC compiler crashed: ${e.message}
${e.stack}`,
        file: undefined,
        start: undefined,
        length: undefined,
      });
    }
  }
  return programDiagnostics;
}

function createIssueFromDiagnostic(diagnostic: ts.Diagnostic): Issue {
  let file: string | undefined;
  let location: IssueLocation | undefined;

  if (diagnostic.file) {
    file = diagnostic.file.fileName;

    if (diagnostic.start && diagnostic.length) {
      const { line: startLine, character: startCharacter } =
        diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const { line: endLine, character: endCharacter } =
        diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start + diagnostic.length);

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

export function createIssuesFromDiagnostics(diagnostics: ts.Diagnostic[]): Issue[] {
  return deduplicateAndSortIssues(
    diagnostics.map((diagnostic) => createIssueFromDiagnostic(diagnostic))
  );
}
