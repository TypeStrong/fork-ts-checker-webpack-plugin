var os = require('os');
var mockFs = require('mock-fs');
var NormalizedMessage = require('../../lib/NormalizedMessage')
  .NormalizedMessage;
var createCodeframeFormatter = require('../../lib/formatter/codeframeFormatter')
  .createCodeframeFormatter;

describe('[UNIT] formatter/codeframeFormatter', () => {
  beforeEach(() => {
    mockFs({
      some: {
        'file.ts': [
          'class SomeClass {',
          '  private someProperty: boolean;',
          '  constructor() {',
          "    console.log('anything special');",
          '  }',
          '}'
        ].join('\n')
      }
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  test('should format normalized diagnostic message', () => {
    var message = new NormalizedMessage({
      type: NormalizedMessage.TYPE_DIAGNOSTIC,
      code: 123,
      severity: NormalizedMessage.SEVERITY_ERROR,
      content: 'Some diagnostic content',
      file: 'some/file.ts',
      line: 1,
      character: 7
    });
    var formatter = createCodeframeFormatter({
      linesAbove: 1,
      linesBelow: 1
    });
    var formattedMessage = formatter(message, false);

    expect(formattedMessage).toBe(
      'ERROR in some/file.ts' +
        os.EOL +
        '1:7 Some diagnostic content' +
        os.EOL +
        '  > 1 | class SomeClass {' +
        os.EOL +
        '      |       ^' +
        os.EOL +
        '    2 |   private someProperty: boolean;'
    );
  });

  test('should format normalized lint message', () => {
    var message = new NormalizedMessage({
      type: NormalizedMessage.TYPE_LINT,
      code: 'some-lint-rule',
      severity: NormalizedMessage.SEVERITY_WARNING,
      content: 'Some lint content',
      file: 'some/file.ts',
      line: 2,
      character: 11
    });
    var formatter = createCodeframeFormatter({
      linesAbove: 1,
      linesBelow: 1
    });
    var formattedMessage = formatter(message, false);

    expect(formattedMessage).toBe(
      'WARNING in some/file.ts' +
        os.EOL +
        '2:11 Some lint content' +
        os.EOL +
        '    1 | class SomeClass {' +
        os.EOL +
        '  > 2 |   private someProperty: boolean;' +
        os.EOL +
        '      |           ^' +
        os.EOL +
        '    3 |   constructor() {'
    );
  });

  test('should format normalized message without file', () => {
    var message = new NormalizedMessage({
      type: NormalizedMessage.TYPE_LINT,
      code: 'some-lint-rule',
      severity: NormalizedMessage.SEVERITY_WARNING,
      content: 'Some lint content',
      file: 'some/unknown-file.ts',
      line: 2,
      character: 11
    });
    var formatter = createCodeframeFormatter({
      linesAbove: 1,
      linesBelow: 1
    });
    var formattedMessage = formatter(message, false);

    expect(formattedMessage).toBe(
      'WARNING in some/unknown-file.ts' + os.EOL + '2:11 Some lint content'
    );
  });
});
