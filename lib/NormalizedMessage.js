
function NormalizedMessage (data) {
  this.type = data.type;
  this.code = data.code;
  this.severity = data.severity;
  this.content = data.content;
  this.file = data.file;
  this.line = data.line;
  this.character = data.character;
}
module.exports = NormalizedMessage;

// message types
NormalizedMessage.TYPE_DIAGNOSTIC = 'diagnostic';
NormalizedMessage.TYPE_LINT = 'lint';

// severity types
NormalizedMessage.SEVERITY_ERROR = 'error';
NormalizedMessage.SEVERITY_WARNING = 'warning';

NormalizedMessage.createFromDiagnostic = function (diagnostic) {
  var ts = require('typescript');
  var position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);

  return new NormalizedMessage({
    type: NormalizedMessage.TYPE_DIAGNOSTIC,
    code: diagnostic.code,
    severity: ts.DiagnosticCategory[diagnostic.category].toLowerCase(),
    content: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    file: diagnostic.file.fileName,
    line: position.line + 1,
    character: position.character + 1
  });
};

NormalizedMessage.createFromLint = function (lint) {
  var position = lint.getStartPosition().getLineAndCharacter();

  return new NormalizedMessage({
    type: NormalizedMessage.TYPE_LINT,
    code: lint.getRuleName(),
    severity: lint.getRuleSeverity(),
    content: lint.getFailure(),
    file: lint.getFileName(),
    line: position.line + 1,
    character: position.character + 1
  });
};

NormalizedMessage.createFromJSON = function (json) {
  return new NormalizedMessage(json);
};

NormalizedMessage.compare = function (messageA, messageB) {
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
    NormalizedMessage.compareOptionalStrings(messageA.getCode(), messageB.getCode()) ||
    NormalizedMessage.compareOptionalStrings(messageA.getContent(), messageB.getContent()) ||
    0 /* EqualTo */
  );
};

NormalizedMessage.equals = function (messageA, messageB) {
  return NormalizedMessage.compare(messageA, messageB) === 0;
};

NormalizedMessage.deduplicate = function (messages) {
  return messages
    .sort(NormalizedMessage.compare)
    .filter(function (message, index) {
      return index === 0 || !NormalizedMessage.equals(message, messages[index - 1]);
    });
};

NormalizedMessage.compareTypes = function (typeA, typeB) {
  var priorities = [typeA, typeB].map(function (type) {
    return [
      NormalizedMessage.TYPE_LINT /* 0 */,
      NormalizedMessage.TYPE_DIAGNOSTIC /* 1 */
    ].indexOf(type);
  });

  return priorities[0] - priorities[1];
};

NormalizedMessage.compareSeverities = function (severityA, severityB) {
  var priorities = [severityA, severityB].map(function (type) {
    return [
      NormalizedMessage.SEVERITY_WARNING /* 0 */,
      NormalizedMessage.SEVERITY_ERROR /* 1 */
    ].indexOf(type);
  });

  return priorities[0] - priorities[1];
};

NormalizedMessage.compareOptionalStrings = function (stringA, stringB) {
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
};

NormalizedMessage.compareNumbers = function (numberA, numberB) {
  return numberA - numberB;
};

NormalizedMessage.prototype.toJSON = function () {
  return {
    type: this.type,
    code: this.code,
    severity: this.severity,
    content: this.content,
    file: this.file,
    line: this.line,
    character: this.character
  };
};

NormalizedMessage.prototype.getType = function () {
  return this.type;
};

NormalizedMessage.prototype.isDiagnosticType = function () {
  return NormalizedMessage.TYPE_DIAGNOSTIC === this.getType();
};

NormalizedMessage.prototype.isLintType = function () {
  return NormalizedMessage.TYPE_LINT === this.getType();
};

NormalizedMessage.prototype.getCode = function () {
  return this.code;
};

NormalizedMessage.prototype.getFormattedCode = function () {
  return this.isDiagnosticType() ? 'TS' + this.getCode() : this.getCode();
};

NormalizedMessage.prototype.getSeverity = function () {
  return this.severity;
};

NormalizedMessage.prototype.isErrorSeverity = function () {
  return this.getSeverity() === NormalizedMessage.SEVERITY_ERROR;
};

NormalizedMessage.prototype.isWarningSeverity = function () {
  return this.getSeverity() === NormalizedMessage.SEVERITY_WARNING;
};

NormalizedMessage.prototype.getContent = function () {
  return this.content;
};

NormalizedMessage.prototype.getFile = function () {
  return this.file;
};

NormalizedMessage.prototype.getLine = function () {
  return this.line;
};

NormalizedMessage.prototype.getCharacter = function () {
  return this.character;
};
