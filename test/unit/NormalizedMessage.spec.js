var NormalizedMessage = require('../../lib/NormalizedMessage')
  .NormalizedMessage;

describe('[UNIT] NormalizedMessage', () => {
  var diagnosticMessage;
  var lintMessage;

  beforeEach(() => {
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

  test('should create new message', () => {
    expect(diagnosticMessage.type).toBe('diagnostic');
    expect(diagnosticMessage.code).toBe(123);
    expect(diagnosticMessage.severity).toBe('error');
    expect(diagnosticMessage.content).toBe('foo');
    expect(diagnosticMessage.file).toBe('/foo/bar.ts');
    expect(diagnosticMessage.line).toBe(532);
    expect(diagnosticMessage.character).toBe(12);
  });

  test('should serialize and create from json', () => {
    var json = diagnosticMessage.toJSON();

    expect(typeof json).toBe('object');

    var jsonMessage = NormalizedMessage.createFromJSON(json);

    expect(jsonMessage).toBeInstanceOf(NormalizedMessage);
    expect(jsonMessage.type).toBe(diagnosticMessage.type);
    expect(jsonMessage.code).toBe(diagnosticMessage.code);
    expect(jsonMessage.severity).toBe(diagnosticMessage.severity);
    expect(jsonMessage.content).toBe(diagnosticMessage.content);
    expect(jsonMessage.file).toBe(diagnosticMessage.file);
    expect(jsonMessage.line).toBe(diagnosticMessage.line);
    expect(jsonMessage.character).toBe(diagnosticMessage.character);
  });

  test('should check type', () => {
    expect(diagnosticMessage.isDiagnosticType()).toBe(true);
    expect(diagnosticMessage.isLintType()).toBe(false);
    expect(lintMessage.isDiagnosticType()).toBe(false);
    expect(lintMessage.isLintType()).toBe(true);
  });

  test('should return formatted code', () => {
    expect(diagnosticMessage.getFormattedCode()).toBe(
      'TS' + diagnosticMessage.code
    );
    expect(lintMessage.getFormattedCode()).toBe(lintMessage.code);
  });

  test('should check severity', () => {
    expect(diagnosticMessage.isErrorSeverity()).toBe(true);
    expect(diagnosticMessage.isWarningSeverity()).toBe(false);
    expect(lintMessage.isErrorSeverity()).toBe(false);
    expect(lintMessage.isWarningSeverity()).toBe(true);
  });

  test('should compare numbers in asc', () => {
    expect(NormalizedMessage.compareNumbers(123, 126)).toBeLessThan(0);
    expect(NormalizedMessage.compareNumbers(-123, 126)).toBeLessThan(0);
    expect(NormalizedMessage.compareNumbers(-126, -123)).toBeLessThan(0);
    expect(NormalizedMessage.compareNumbers(132, 42)).toBeGreaterThan(0);
    expect(NormalizedMessage.compareNumbers(132, -42)).toBeGreaterThan(0);
    expect(NormalizedMessage.compareNumbers(-42, -132)).toBeGreaterThan(0);
    expect(NormalizedMessage.compareNumbers(15, 15)).toBe(0);
    expect(NormalizedMessage.compareNumbers(0, 0)).toBe(0);
    expect(NormalizedMessage.compareNumbers(-15, -15)).toBe(0);
  });

  test('should compare strings in asc', () => {
    expect(NormalizedMessage.compareOptionalStrings('abc', 'xyz')).toBeLessThan(
      0
    );
    expect(
      NormalizedMessage.compareOptionalStrings(undefined, 'xyz')
    ).toBeLessThan(0);
    expect(NormalizedMessage.compareOptionalStrings(null, 'xyz')).toBeLessThan(
      0
    );
    expect(
      NormalizedMessage.compareOptionalStrings('xyz', 'abc')
    ).toBeGreaterThan(0);
    expect(
      NormalizedMessage.compareOptionalStrings('xyz', undefined)
    ).toBeGreaterThan(0);
    expect(
      NormalizedMessage.compareOptionalStrings('xyz', null)
    ).toBeGreaterThan(0);
    expect(NormalizedMessage.compareOptionalStrings('xyz', 'xyz')).toBe(0);
    expect(NormalizedMessage.compareOptionalStrings(undefined, undefined)).toBe(
      0
    );
    expect(NormalizedMessage.compareOptionalStrings(null, null)).toBe(0);
  });

  test('should compare severities in asc', () => {
    expect(
      NormalizedMessage.compareSeverities('warning', 'error')
    ).toBeLessThan(0);
    expect(
      NormalizedMessage.compareSeverities('unknown', 'warning')
    ).toBeLessThan(0);
    expect(
      NormalizedMessage.compareSeverities('error', 'warning')
    ).toBeGreaterThan(0);
    expect(
      NormalizedMessage.compareSeverities('warning', 'unknown')
    ).toBeGreaterThan(0);
    expect(NormalizedMessage.compareSeverities('error', 'error')).toBe(0);
    expect(NormalizedMessage.compareSeverities('warning', 'warning')).toBe(0);
    expect(NormalizedMessage.compareSeverities('unknown', 'unknown')).toBe(0);
    expect(
      NormalizedMessage.compareSeverities('unknown', 'another_unknown')
    ).toBe(0);
  });

  test('should compare types in asc', () => {
    expect(NormalizedMessage.compareTypes('lint', 'diagnostic')).toBeLessThan(
      0
    );
    expect(NormalizedMessage.compareTypes('unknown', 'lint')).toBeLessThan(0);
    expect(
      NormalizedMessage.compareTypes('diagnostic', 'lint')
    ).toBeGreaterThan(0);
    expect(NormalizedMessage.compareTypes('lint', 'unknown')).toBeGreaterThan(
      0
    );
    expect(NormalizedMessage.compareTypes('diagnostic', 'diagnostic')).toBe(0);
    expect(NormalizedMessage.compareTypes('lint', 'lint')).toBe(0);
    expect(NormalizedMessage.compareTypes('unknown', 'unknown')).toBe(0);
    expect(NormalizedMessage.compareTypes('unknown', 'another_unknown')).toBe(
      0
    );
  });

  test('should compare messages', () => {
    var messageA = diagnosticMessage;
    function buildMessage(diff) {
      return NormalizedMessage.createFromJSON({
        ...messageA.toJSON(),
        ...diff
      });
    }

    expect(NormalizedMessage.compare(messageA, undefined)).toBeGreaterThan(0);
    expect(NormalizedMessage.compare(undefined, messageA)).toBeLessThan(0);
    expect(NormalizedMessage.compare(messageA, {})).toBeGreaterThan(0);
    expect(NormalizedMessage.compare({}, messageA)).toBeLessThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ type: 'lint' }))
    ).toBeGreaterThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ file: '/goo/bar.ts' }))
    ).toBeLessThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ severity: 'notice' }))
    ).toBeGreaterThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ line: 400 }))
    ).toBeGreaterThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ character: 200 }))
    ).toBeLessThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ code: 100 }))
    ).toBeGreaterThan(0);
    expect(
      NormalizedMessage.compare(messageA, buildMessage({ content: 'bar' }))
    ).toBeGreaterThan(0);
  });

  test('should check if messages are equal', () => {
    var messageA = diagnosticMessage;
    var messageB = NormalizedMessage.createFromJSON(diagnosticMessage.toJSON());
    var messageC = lintMessage;
    var messageD = NormalizedMessage.createFromJSON(lintMessage.toJSON());

    expect(NormalizedMessage.equals(messageA, messageB)).toBe(true);
    expect(NormalizedMessage.equals(messageA, messageC)).toBe(false);
    expect(NormalizedMessage.equals(messageA, messageD)).toBe(false);
    expect(NormalizedMessage.equals(messageB, messageC)).toBe(false);
    expect(NormalizedMessage.equals(messageB, messageD)).toBe(false);
    expect(NormalizedMessage.equals(messageC, messageD)).toBe(true);
  });

  test('should deduplicate list of messages', () => {
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

    expect(Array.isArray(unique)).toBe(true);
    expect(unique).toEqual([messageC, messageA]);
  });
});
