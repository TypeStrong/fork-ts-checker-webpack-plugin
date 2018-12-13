import {
  Diagnostic,
  DiagnosticCategory,
  flattenDiagnosticMessageText
} from 'typescript';
import { RuleFailure } from 'tslint';

type ErrorType = 'diagnostic' | 'lint';
type Severity = 'error' | 'warning';

interface NormalizedMessageJson {
  type: ErrorType;
  code: string | number;
  severity: Severity;
  content: string;
  file?: string;
  line?: number;
  character?: number;
}

export class NormalizedMessage {
  public static readonly TYPE_DIAGNOSTIC: ErrorType = 'diagnostic';
  public static readonly TYPE_LINT: ErrorType = 'lint';

  // severity types
  public static readonly SEVERITY_ERROR: Severity = 'error';
  public static readonly SEVERITY_WARNING: Severity = 'warning';

  public readonly type: ErrorType;
  public readonly code: string | number;
  public readonly severity: Severity;
  public readonly content: string;
  public readonly file?: string;
  public readonly line?: number;
  public readonly character?: number;

  constructor(data: NormalizedMessageJson) {
    this.type = data.type;
    this.code = data.code;
    this.severity = data.severity;
    this.content = data.content;
    this.file = data.file;
    this.line = data.line;
    this.character = data.character;
  }

  // message types
  public static createFromDiagnostic(diagnostic: Diagnostic) {
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
      severity: DiagnosticCategory[
        diagnostic.category
      ].toLowerCase() as Severity,
      content: flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      file,
      line,
      character
    });
  }

  public static createFromLint(lint: RuleFailure) {
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
  }

  public static createFromJSON(json: NormalizedMessageJson) {
    return new NormalizedMessage(json);
  }

  public static compare(
    messageA: NormalizedMessage,
    messageB: NormalizedMessage
  ) {
    if (!(messageA instanceof NormalizedMessage)) {
      return -1;
    }
    if (!(messageB instanceof NormalizedMessage)) {
      return 1;
    }

    return (
      NormalizedMessage.compareTypes(messageA.type, messageB.type) ||
      NormalizedMessage.compareOptionalStrings(messageA.file, messageB.file) ||
      NormalizedMessage.compareSeverities(
        messageA.severity,
        messageB.severity
      ) ||
      NormalizedMessage.compareNumbers(messageA.line, messageB.line) ||
      NormalizedMessage.compareNumbers(
        messageA.character,
        messageB.character
      ) ||
      // code can be string (lint failure) or number (typescript error) - should the following line cater for this in some way?
      NormalizedMessage.compareOptionalStrings(
        messageA.code as string,
        messageB.code as string
      ) ||
      NormalizedMessage.compareOptionalStrings(
        messageA.content,
        messageB.content
      ) ||
      0 /* EqualTo */
    );
  }

  public static equals(
    messageA: NormalizedMessage,
    messageB: NormalizedMessage
  ) {
    return this.compare(messageA, messageB) === 0;
  }

  public static deduplicate(messages: NormalizedMessage[]) {
    return messages.sort(NormalizedMessage.compare).filter((message, index) => {
      return (
        index === 0 || !NormalizedMessage.equals(message, messages[index - 1])
      );
    });
  }

  public static compareTypes(typeA: ErrorType, typeB: ErrorType) {
    const priorities = [typeA, typeB].map(type => {
      return [
        NormalizedMessage.TYPE_LINT /* 0 */,
        NormalizedMessage.TYPE_DIAGNOSTIC /* 1 */
      ].indexOf(type);
    });

    return priorities[0] - priorities[1];
  }

  public static compareSeverities(severityA: Severity, severityB: Severity) {
    const priorities = [severityA, severityB].map(type => {
      return [
        NormalizedMessage.SEVERITY_WARNING /* 0 */,
        NormalizedMessage.SEVERITY_ERROR /* 1 */
      ].indexOf(type);
    });

    return priorities[0] - priorities[1];
  }

  public static compareOptionalStrings(stringA?: string, stringB?: string) {
    if (stringA === stringB) {
      return 0;
    }
    if (stringA === undefined || stringA === null) {
      return -1;
    }
    if (stringB === undefined || stringB === null) {
      return 1;
    }

    return stringA.toString().localeCompare(stringB.toString());
  }

  public static compareNumbers(numberA?: number, numberB?: number) {
    if (numberA === numberB) {
      return 0;
    }
    if (numberA === undefined || numberA === null) {
      return -1;
    }
    if (numberB === undefined || numberB === null) {
      return 1;
    }
    return numberA - numberB;
  }

  public toJSON() {
    return {
      type: this.type,
      code: this.code,
      severity: this.severity,
      content: this.content,
      file: this.file,
      line: this.line,
      character: this.character
    } as NormalizedMessageJson;
  }

  public isDiagnosticType() {
    return NormalizedMessage.TYPE_DIAGNOSTIC === this.type;
  }

  public isLintType() {
    return NormalizedMessage.TYPE_LINT === this.type;
  }

  public getFormattedCode() {
    return this.isDiagnosticType() ? 'TS' + this.code : this.code;
  }

  public isErrorSeverity() {
    return this.severity === NormalizedMessage.SEVERITY_ERROR;
  }

  public isWarningSeverity() {
    return this.severity === NormalizedMessage.SEVERITY_WARNING;
  }
}
