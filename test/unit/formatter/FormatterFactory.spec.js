const os = require('os');
const mockFs = require('mock-fs');
const { createFormatter } = require('../../../lib/formatter');
const { IssueOrigin, IssueSeverity } = require('../../../lib/issue');

describe('[UNIT] formatter/FormatterFactory', () => {
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

  const issue = {
    origin: IssueOrigin.TYPESCRIPT,
    severity: IssueSeverity.ERROR,
    code: 123,
    message: 'Some issue content',
    file: 'some/file.ts',
    line: 1,
    character: 7
  };

  it.each(['default', undefined])('creates default formatter', type => {
    const formatter = createFormatter(type);
    const formattedMessage = formatter(issue);

    expect(formattedMessage).toEqual(
      ['ERROR in some/file.ts(1,7):', 'TS123: Some issue content'].join(os.EOL)
    );
  });

  it('creates codeframe formatter', () => {
    const formatter = createFormatter('codeframe');
    const formattedMessage = formatter(issue);

    expect(formattedMessage).toEqual(
      [
        'ERROR in some/file.ts(1,7):',
        '1:7 Some issue content',
        '  > 1 | class SomeClass {',
        '      |       ^',
        '    2 |   private someProperty: boolean;',
        '    3 |   constructor() {',
        "    4 |     console.log('anything special');"
      ].join(os.EOL)
    );
  });

  it('creates codeframe formatter with custom options', () => {
    const formatter = createFormatter('codeframe', {
      linesAbove: 1,
      linesBelow: 1
    });
    const formattedMessage = formatter(issue);

    expect(formattedMessage).toEqual(
      [
        'ERROR in some/file.ts(1,7):',
        '1:7 Some issue content',
        '  > 1 | class SomeClass {',
        '      |       ^',
        '    2 |   private someProperty: boolean;'
      ].join(os.EOL)
    );
  });

  it('forwards already created formatter', () => {
    const formatter = createFormatter(issue => issue.message);
    const formattedMessage = formatter(issue);

    expect(formattedMessage).toEqual('Some issue content');
  });

  it('throws an error on unknown formatter type', () => {
    expect(() => createFormatter('unknown-type')).toThrowError(
      `Unknown "unknown-type" formatter. Available types are: default, codeframe.`
    );
  });
});
