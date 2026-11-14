import * as os from 'os';
import * as path from 'path';

import type { Diagnostic, Program } from 'typescript/sync';

import type { Issue, IssueLocation } from '../../../issue';
import { deduplicateAndSortIssues } from '../../../issue';

import { config } from './worker-config';

// matches TypeScript's DiagnosticCategory
const DIAGNOSTIC_CATEGORY_WARNING = 0;

const diagnosticsPerConfigFile = new Map<string, Diagnostic[]>();

export function updateDiagnostics(configFile: string, diagnostics: Diagnostic[]): void {
  diagnosticsPerConfigFile.set(configFile, diagnostics);
}

export function getIssues(): Issue[] {
  const allDiagnostics: Diagnostic[] = [];

  diagnosticsPerConfigFile.forEach((diagnostics) => {
    allDiagnostics.push(...diagnostics);
  });

  return createIssuesFromDiagnostics(allDiagnostics);
}

export function invalidateDiagnostics(): void {
  diagnosticsPerConfigFile.clear();
}

export function createCrashDiagnostic(error: unknown): Diagnostic {
  return {
    pos: -1,
    end: -1,
    code: 1,
    category: 1,
    text: `TSC compiler crashed: ${
      error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
    }`,
  };
}

export function getDiagnosticsOfProgram(program: Program): Diagnostic[] {
  // errors aren't caught here: the worker reports them and resets the compiler
  const programDiagnostics: Diagnostic[] = [];
  // compiler options diagnostics (e.g. a removed `target`)
  programDiagnostics.push(...program.getProgramDiagnostics());
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

function createIssueFromDiagnostic(diagnostic: Diagnostic): Issue {
  let file: string | undefined;
  let location: IssueLocation | undefined;

  if (diagnostic.fileName) {
    // the API always returns forward-slashed paths
    file = path.normalize(diagnostic.fileName);

    if (diagnostic.startPosition && diagnostic.endPosition) {
      location = {
        start: {
          line: diagnostic.startPosition.line + 1,
          column: diagnostic.startPosition.character + 1,
        },
        end: {
          line: diagnostic.endPosition.line + 1,
          column: diagnostic.endPosition.character + 1,
        },
      };
    }
  }

  return {
    code: (diagnostic.source || 'TS') + String(diagnostic.code),
    // we don't handle Suggestion and Message diagnostics
    severity: diagnostic.category === DIAGNOSTIC_CATEGORY_WARNING ? 'warning' : 'error',
    message: flattenDiagnosticMessageText(diagnostic),
    file,
    location,
  };
}

// same output as TypeScript's classic `flattenDiagnosticMessageText`
function flattenDiagnosticMessageText(diagnostic: Diagnostic, indent = 0): string {
  let result = indent ? os.EOL + '  '.repeat(indent) + diagnostic.text : diagnostic.text;
  for (const chained of diagnostic.messageChain ?? []) {
    result += flattenDiagnosticMessageText(chained, indent + 1);
  }
  return result;
}

export function createIssuesFromDiagnostics(diagnostics: readonly Diagnostic[]): Issue[] {
  return deduplicateAndSortIssues(
    diagnostics.map((diagnostic) => createIssueFromDiagnostic(diagnostic))
  );
}
