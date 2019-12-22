import * as os from 'os';
import { Issue, IssueSeverity, IssueOrigin } from '../../../lib/issue';
import { createInternalFormatter } from '../../../lib/formatter';

describe('[UNIT] formatter/InternalFormatter', () => {
  it.each([
    [
      {
        origin: IssueOrigin.INTERNAL,
        severity: IssueSeverity.ERROR,
        code: 'INTERNAL',
        message: `Stack overflow - out of memory`
      },
      'INTERNAL ERROR: Stack overflow - out of memory'
    ],
    [
      {
        origin: IssueOrigin.INTERNAL,
        severity: IssueSeverity.ERROR,
        code: 'INTERNAL',
        message: `Stack overflow - out of memory`,
        stack: [
          `Security context: 0x35903c44a49 <JS Object>`,
          `1: walkFunctionDeclaration [<PROJECT_DIR>/node_modules/webpack/lib/Parser.js:~443] [pc=0xa07a14ec8ee] (this=0x59f67991119 <a Parser with map 0x71f2d115d49>,statement=0x3507a80af661 <a Node with map 0x71f2d1157c9>)`,
          `2: walkStatement [<PROJECT_DIR>/node_modules/webpack/lib/Parser.js:~348] [pc=0xa07a06dfc10] (this=0x59f6799111...`,
          ``,
          `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - process out of memory`,
          `Abort trap: 6`
        ].join(os.EOL)
      },
      [
        'INTERNAL ERROR: Stack overflow - out of memory',
        'stack trace:',
        `Security context: 0x35903c44a49 <JS Object>`,
        `1: walkFunctionDeclaration [<PROJECT_DIR>/node_modules/webpack/lib/Parser.js:~443] [pc=0xa07a14ec8ee] (this=0x59f67991119 <a Parser with map 0x71f2d115d49>,statement=0x3507a80af661 <a Node with map 0x71f2d1157c9>)`,
        `2: walkStatement [<PROJECT_DIR>/node_modules/webpack/lib/Parser.js:~348] [pc=0xa07a06dfc10] (this=0x59f6799111...`,
        ``,
        `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - process out of memory`,
        `Abort trap: 6`
      ].join(os.EOL)
    ]
  ])('formats issue message "%p" to "%p"', (issue, expectedFormatted) => {
    const formatter = createInternalFormatter();
    const formatted = formatter(issue as Issue);

    expect(formatted).toEqual(expectedFormatted);
  });

  it('throws an error on non-internal issue format', () => {
    const formatter = createInternalFormatter();
    const issue = {
      origin: IssueOrigin.TYPESCRIPT,
      severity: IssueSeverity.ERROR,
      code: '2322',
      message: `Type '"1"' is not assignable to type 'number'.`,
      file: 'src/index.ts',
      line: 1,
      character: 7
    };

    expect(() => formatter(issue)).toThrowError(
      `Not supported "${IssueOrigin.TYPESCRIPT}" issue origin.`
    );
  });
});
