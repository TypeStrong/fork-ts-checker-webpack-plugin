var describe = require('mocha').describe;
var it = require('mocha').it;
var beforeEach = require('mocha').beforeEach;
var expect = require('chai').expect;
var NormalizedMessage = require('../../lib/NormalizedMessage')
  .NormalizedMessage;

describe('[UNIT] NormalizedMessage', function() {
  var diagnosticMessage;
  var lintMessage;

  beforeEach(function() {
    diagnosticMessage = new NormalizedMessage({
      type: 'diagnostic',
      code: 123,
      severity: 'error',
      content: 'foo',
      file: '/foo/bar.ts',
      line: 532,
      character: 12
    });

    lintMessage = new NormalizedMessage({
      type: 'lint',
      code: 321,
      severity: 'warning',
      content: 'bar',
      file: '/bar/foo.tsx',
      line: 890,
      character: 11
    });
  });

  it('should create new message', function() {
    expect(diagnosticMessage.type).to.be.equal('diagnostic');
    expect(diagnosticMessage.code).to.be.equal(123);
    expect(diagnosticMessage.severity).to.be.equal('error');
    expect(diagnosticMessage.content).to.be.equal('foo');
    expect(diagnosticMessage.file).to.be.equal('/foo/bar.ts');
    expect(diagnosticMessage.line).to.be.equal(532);
    expect(diagnosticMessage.character).to.be.equal(12);
  });

  it('should serialize and create from json', function() {
    var json = diagnosticMessage.toJSON();

    expect(json).to.be.an('object');

    var jsonMessage = NormalizedMessage.createFromJSON(json);

    expect(jsonMessage).to.be.instanceof(NormalizedMessage);
    expect(jsonMessage.type).to.be.equal(diagnosticMessage.type);
    expect(jsonMessage.code).to.be.equal(diagnosticMessage.code);
    expect(jsonMessage.severity).to.be.equal(
      diagnosticMessage.severity
    );
    expect(jsonMessage.content).to.be.equal(
      diagnosticMessage.content
    );
    expect(jsonMessage.file).to.be.equal(diagnosticMessage.file);
    expect(jsonMessage.line).to.be.equal(diagnosticMessage.line);
    expect(jsonMessage.character).to.be.equal(
      diagnosticMessage.character
    );
  });

  it('should check type', function() {
    expect(diagnosticMessage.isDiagnosticType()).to.be.true;
    expect(diagnosticMessage.isLintType()).to.be.false;
    expect(lintMessage.isDiagnosticType()).to.be.false;
    expect(lintMessage.isLintType()).to.be.true;
  });

  it('should return formatted code', function() {
    expect(diagnosticMessage.getFormattedCode()).to.be.equal(
      'TS' + diagnosticMessage.code
    );
    expect(lintMessage.getFormattedCode()).to.be.equal(lintMessage.code);
  });

  it('should check severity', function() {
    expect(diagnosticMessage.isErrorSeverity()).to.be.true;
    expect(diagnosticMessage.isWarningSeverity()).to.be.false;
    expect(lintMessage.isErrorSeverity()).to.be.false;
    expect(lintMessage.isWarningSeverity()).to.be.true;
  });

  it('should compare numbers in asc', function() {
    expect(NormalizedMessage.compareNumbers(123, 126)).to.be.lessThan(0);
    expect(NormalizedMessage.compareNumbers(-123, 126)).to.be.lessThan(0);
    expect(NormalizedMessage.compareNumbers(-126, -123)).to.be.lessThan(0);
    expect(NormalizedMessage.compareNumbers(132, 42)).to.be.greaterThan(0);
    expect(NormalizedMessage.compareNumbers(132, -42)).to.be.greaterThan(0);
    expect(NormalizedMessage.compareNumbers(-42, -132)).to.be.greaterThan(0);
    expect(NormalizedMessage.compareNumbers(15, 15)).to.be.equal(0);
    expect(NormalizedMessage.compareNumbers(0, 0)).to.be.equal(0);
    expect(NormalizedMessage.compareNumbers(-15, -15)).to.be.equal(0);
  });

  it('should compare strings in asc', function() {
    expect(
      NormalizedMessage.compareOptionalStrings('abc', 'xyz')
    ).to.be.lessThan(0);
    expect(
      NormalizedMessage.compareOptionalStrings(undefined, 'xyz')
    ).to.be.lessThan(0);
    expect(
      NormalizedMessage.compareOptionalStrings(null, 'xyz')
    ).to.be.lessThan(0);
    expect(
      NormalizedMessage.compareOptionalStrings('xyz', 'abc')
    ).to.be.greaterThan(0);
    expect(
      NormalizedMessage.compareOptionalStrings('xyz', undefined)
    ).to.be.greaterThan(0);
    expect(
      NormalizedMessage.compareOptionalStrings('xyz', null)
    ).to.be.greaterThan(0);
    expect(NormalizedMessage.compareOptionalStrings('xyz', 'xyz')).to.be.equal(
      0
    );
    expect(
      NormalizedMessage.compareOptionalStrings(undefined, undefined)
    ).to.be.equal(0);
    expect(NormalizedMessage.compareOptionalStrings(null, null)).to.be.equal(0);
  });

  it('should compare severities in asc', function() {
    expect(
      NormalizedMessage.compareSeverities('warning', 'error')
    ).to.be.lessThan(0);
    expect(
      NormalizedMessage.compareSeverities('unknown', 'warning')
    ).to.be.lessThan(0);
    expect(
      NormalizedMessage.compareSeverities('error', 'warning')
    ).to.be.greaterThan(0);
    expect(
      NormalizedMessage.compareSeverities('warning', 'unknown')
    ).to.be.greaterThan(0);
    expect(NormalizedMessage.compareSeverities('error', 'error')).to.be.equal(
      0
    );
    expect(
      NormalizedMessage.compareSeverities('warning', 'warning')
    ).to.be.equal(0);
    expect(
      NormalizedMessage.compareSeverities('unknown', 'unknown')
    ).to.be.equal(0);
    expect(
      NormalizedMessage.compareSeverities('unknown', 'another_unknown')
    ).to.be.equal(0);
  });

  it('should compare types in asc', function() {
    expect(NormalizedMessage.compareTypes('lint', 'diagnostic')).to.be.lessThan(
      0
    );
    expect(NormalizedMessage.compareTypes('unknown', 'lint')).to.be.lessThan(0);
    expect(
      NormalizedMessage.compareTypes('diagnostic', 'lint')
    ).to.be.greaterThan(0);
    expect(NormalizedMessage.compareTypes('lint', 'unknown')).to.be.greaterThan(
      0
    );
    expect(
      NormalizedMessage.compareTypes('diagnostic', 'diagnostic')
    ).to.be.equal(0);
    expect(NormalizedMessage.compareTypes('lint', 'lint')).to.be.equal(0);
    expect(NormalizedMessage.compareTypes('unknown', 'unknown')).to.be.equal(0);
    expect(
      NormalizedMessage.compareTypes('unknown', 'another_unknown')
    ).to.be.equal(0);
  });

  it('should compare messages', function() {
    var messageA = diagnosticMessage;
    function buildMessage(diff) {
      return NormalizedMessage.createFromJSON(
        Object.assign({}, messageA.toJSON(), diff)
      );
    }

    expect(NormalizedMessage.compare(messageA, undefined)).to.be.greaterThan(0);
    expect(NormalizedMessage.compare(undefined, messageA)).to.be.lessThan(0);
    expect(NormalizedMessage.compare(messageA, {})).to.be.greaterThan(0);
    expect(NormalizedMessage.compare({}, messageA)).to.be.lessThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ type: 'lint' }))
    ).to.be.greaterThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ file: '/goo/bar.ts' }))
    ).to.be.lessThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ severity: 'notice' }))
    ).to.be.greaterThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ line: 400 }))
    ).to.be.greaterThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ character: 200 }))
    ).to.be.lessThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ code: 100 }))
    ).to.be.greaterThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ content: 'bar' }))
    ).to.be.greaterThan(0);
  });

  it('should check if messages are equal', function() {
    var messageA = diagnosticMessage;
    var messageB = NormalizedMessage.createFromJSON(diagnosticMessage.toJSON());
    var messageC = lintMessage;
    var messageD = NormalizedMessage.createFromJSON(lintMessage.toJSON());

    expect(NormalizedMessage.equals(messageA, messageB)).to.be.true;
    expect(NormalizedMessage.equals(messageA, messageC)).to.be.false;
    expect(NormalizedMessage.equals(messageA, messageD)).to.be.false;
    expect(NormalizedMessage.equals(messageB, messageC)).to.be.false;
    expect(NormalizedMessage.equals(messageB, messageD)).to.be.false;
    expect(NormalizedMessage.equals(messageC, messageD)).to.be.true;
  });

  it('should deduplicate list of messages', function() {
    var messageA = diagnosticMessage;
    var messageB = NormalizedMessage.createFromJSON(diagnosticMessage.toJSON());
    var messageC = lintMessage;
    var messageD = NormalizedMessage.createFromJSON(lintMessage.toJSON());

    var messages = [
      messageA,
      messageC,
      messageD,
      messageD,
      messageB,
      messageC,
      messageA
    ];
    var unique = NormalizedMessage.deduplicate(messages);

    expect(unique).to.be.a('array');
    expect(unique).to.be.deep.equal([messageC, messageA]);
  });
});
