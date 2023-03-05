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

export function getDiagnosticsOfProgram(program: ts.Program | ts.BuilderProgram): ts.Diagnostic[] {
  const programDiagnostics: ts.Diagnostic[] = [];

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
