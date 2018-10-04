import { Diagnostic, DiagnosticCategory, flattenDiagnosticMessageText } from 'typescript';
import { RuleFailure } from 'tslint';

type ErrorType = 'diagnostic' | 'lint';
type Severity = 'error' | 'warning';

interface NormalizedMessageJson {
  type: ErrorType;
  code: string | number;
  severity: Severity;
  content: string;
  file: string;
  line: number;
  character: number;
}

export class NormalizedMessage {
  static TYPE_DIAGNOSTIC: ErrorType = 'diagnostic';
  static TYPE_LINT: ErrorType = 'lint';

  // severity types
  static SEVERITY_ERROR: Severity = 'error';
  static SEVERITY_WARNING: Severity = 'warning';

  type: ErrorType;
  code: string | number;
  severity: Severity;
  content: string;
  file: string;
  line: number;
  character: number;

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
  static createFromDiagnostic(diagnostic: Diagnostic) {
    let file: string;
    let line: number;
    let character: number;
    if (diagnostic.file) {
      file = diagnostic.file.fileName;
      const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      line = position.line + 1;
      character = position.character + 1;
    }

    return new NormalizedMessage({
      type: NormalizedMessage.TYPE_DIAGNOSTIC,
      code: diagnostic.code,
      severity: DiagnosticCategory[diagnostic.category].toLowerCase() as Severity,
      content: flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      file: file,
      line: line,
      character: character
    });
  }

  static createFromLint(lint: RuleFailure) {
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

  static createFromJSON(json: NormalizedMessageJson) {
    return new NormalizedMessage(json);
  }

  static compare(messageA: NormalizedMessage, messageB: NormalizedMessage) {
    if (!(messageA instanceof NormalizedMessage)) {
      return -1;
    }
    if (!(messageB instanceof NormalizedMessage)) {
      return 1;
    }

    return (
      NormalizedMessage.compareTypes(messageA.getType(), messageB.getType()) ||
      NormalizedMessage.compareOptionalStrings(messageA.getFile(), messageB.getFile()) ||
      NormalizedMessage.compareSeverities(messageA.getSeverity(), messageB.getSeverity()) ||
      NormalizedMessage.compareNumbers(messageA.getLine(), messageB.getLine()) ||
      NormalizedMessage.compareNumbers(messageA.getCharacter(), messageB.getCharacter()) ||
      // code can be string (lint failure) or number (typescript error) - should the following line cater for this in some way?
      NormalizedMessage.compareOptionalStrings(messageA.getCode() as string, messageB.getCode() as string) ||
      NormalizedMessage.compareOptionalStrings(messageA.getContent(), messageB.getContent()) ||
      0 /* EqualTo */
    );
  }

  static equals(messageA: NormalizedMessage, messageB: NormalizedMessage) {
    return this.compare(messageA, messageB) === 0;
  }

  static deduplicate(messages: NormalizedMessage[]) {
    return messages
      .sort(NormalizedMessage.compare)
      .filter((message, index) => {
        return index === 0 || !NormalizedMessage.equals(message, messages[index - 1]);
      });
  }

  static compareTypes(typeA: ErrorType, typeB: ErrorType) {
    const priorities = [typeA, typeB].map(type => {
      return [
        NormalizedMessage.TYPE_LINT /* 0 */,
        NormalizedMessage.TYPE_DIAGNOSTIC /* 1 */
      ].indexOf(type);
    });

    return priorities[0] - priorities[1];
  }

  static compareSeverities(severityA: Severity, severityB: Severity) {
    const priorities = [severityA, severityB].map((type) => {
      return [
        NormalizedMessage.SEVERITY_WARNING /* 0 */,
        NormalizedMessage.SEVERITY_ERROR /* 1 */
      ].indexOf(type);
    });

    return priorities[0] - priorities[1];
  }

  static compareOptionalStrings(stringA: string, stringB: string) {
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

  static compareNumbers(numberA: number, numberB: number) {
    return numberA - numberB;
  }

  toJSON() {
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

  getType() {
    return this.type;
  }

  isDiagnosticType() {
    return NormalizedMessage.TYPE_DIAGNOSTIC === this.getType();
  }

  isLintType() {
    return NormalizedMessage.TYPE_LINT === this.getType();
  }

  getCode() {
    return this.code;
  }

  getFormattedCode() {
    return this.isDiagnosticType() ? 'TS' + this.getCode() : this.getCode();
  }

  getSeverity() {
    return this.severity;
  }

  isErrorSeverity() {
    return this.getSeverity() === NormalizedMessage.SEVERITY_ERROR;
  }

  isWarningSeverity() {
    return this.getSeverity() === NormalizedMessage.SEVERITY_WARNING;
  }

  getContent() {
    return this.content;
  }

  getFile() {
    return this.file;
  }

  getLine() {
    return this.line;
  }

  getCharacter() {
    return this.character;
  }
}
