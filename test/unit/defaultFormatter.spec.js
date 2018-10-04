
var describe = require('mocha').describe;
var it = require('mocha').it;
var os = require('os');
var expect = require('chai').expect;
var NormalizedMessage = require('../../lib/NormalizedMessage').NormalizedMessage;
var createDefaultFormatter = require('../../lib/formatter/defaultFormatter').createDefaultFormatter;

describe('[UNIT] formatter/defaultFormatter', function () {

  it('should format normalized diagnostic message', function () {
    var message = new NormalizedMessage({
      type: NormalizedMessage.TYPE_DIAGNOSTIC,
      code: 123,
      severity: NormalizedMessage.SEVERITY_ERROR,
      content: 'Some diagnostic content',
      file: '/some/file.ts',
      line: 1,
      character: 5
    });
    var formatter = createDefaultFormatter();
    var formattedMessage = formatter(message, false);

    expect(formattedMessage).to.be.equal(
      'ERROR in /some/file.ts(1,5):' + os.EOL +
      'TS123: Some diagnostic content'
    );
  });

  it('should format normalized lint message', function () {
    var message = new NormalizedMessage({
      type: NormalizedMessage.TYPE_LINT,
      code: 'some-lint-rule',
      severity: NormalizedMessage.SEVERITY_WARNING,
      content: 'Some lint content',
      file: '/some/file.ts',
      line: 2,
      character: 6
    });
    var formatter = createDefaultFormatter();
    var formattedMessage = formatter(message, false);

    expect(formattedMessage).to.be.equal(
      'WARNING in /some/file.ts(2,6):' + os.EOL +
      'some-lint-rule: Some lint content'
    );
  });
});
