// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // import for types alone
// tslint:disable-next-line:no-implicit-dependencies
import * as tslint from 'tslint'; // import for types alone
import { NormalizedMessage, Severity } from './NormalizedMessage';

export const makeCreateNormalizedMessageFromDiagnostic = (
  typescript: typeof ts
) => {
  const createNormalizedMessageFromDiagnostic = (diagnostic: ts.Diagnostic) => {
    let file: string | undefined;
    let line: number | undefined;
    let character: number | undefined;
    if (diagnostic.file) {
      file = diagnostic.file.fileName;
      if (diagnostic.start === undefined) {
        throw new Error('Expected diagnostics to have start');
      }
      const position = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start
      );
      line = position.line + 1;
      character = position.character + 1;
    }

    return new NormalizedMessage({
      type: NormalizedMessage.TYPE_DIAGNOSTIC,
      code: diagnostic.code,
      severity: typescript.DiagnosticCategory[
        diagnostic.category
      ].toLowerCase() as Severity,
      content: typescript.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      ),
      file,
      line,
      character
    });
  };

  return createNormalizedMessageFromDiagnostic;
};

export const makeCreateNormalizedMessageFromRuleFailure = () => {
  const createNormalizedMessageFromRuleFailure = (lint: tslint.RuleFailure) => {
    const position = lint.getStartPosition().getLineAndCharacter();

    return new NormalizedMessage({
      type: NormalizedMessage.TYPE_LINT,
      code: lint.getRuleName(),
      severity: lint.getRuleSeverity() as Severity,
      content: lint.getFailure(),
      file: lint.getFileName(),
      line: position.line + 1,
      character: position.character + 1
    });
  };
  return createNormalizedMessageFromRuleFailure;
};

export const makeCreateNormalizedMessageFromInternalError = () => {
  const createNormalizedMessageFromInternalError = (error: any) => {
    return new NormalizedMessage({
      type: NormalizedMessage.TYPE_DIAGNOSTIC,
      severity: NormalizedMessage.SEVERITY_ERROR,
      code: NormalizedMessage.ERROR_CODE_INTERNAL,
      content:
        typeof error.message === 'string' ? error.message : error.toString(),
      stack: typeof error.stack === 'string' ? error.stack : undefined,
      file: '[internal]'
    });
  };
  return createNormalizedMessageFromInternalError;
};
