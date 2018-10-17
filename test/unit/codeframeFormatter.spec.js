var describe = require('mocha').describe;
var it = require('mocha').it;
var os = require('os');
var beforeEach = require('mocha').beforeEach;
var afterEach = require('mocha').afterEach;
var expect = require('chai').expect;
var mockFs = require('mock-fs');
var NormalizedMessage = require('../../lib/NormalizedMessage')
  .NormalizedMessage;
var createCodeframeFormatter = require('../../lib/formatter/codeframeFormatter')
  .createCodeframeFormatter;

describe('[UNIT] formatter/codeframeFormatter', function() {
  beforeEach(function() {
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

  afterEach(function() {
    mockFs.restore();
  });

  it('should format normalized diagnostic message', function() {
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

    expect(formattedMessage).to.be.equal(
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

  it('should format normalized lint message', function() {
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

    expect(formattedMessage).to.be.equal(
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

  it('should format normalized message without file', function() {
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

    expect(formattedMessage).to.be.equal(
      'WARNING in some/unknown-file.ts' + os.EOL + '2:11 Some lint content'
    );
  });
});
