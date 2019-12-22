import { createIssueFromInternalError } from '../../../../lib/issue';

describe('[UNIT] issue/internal/InternalIssueFactory', () => {
  const ERROR_WITH_MESSAGE_AND_STACK = {
    message: 'Stack overflow - out of memory',
    stack: [
      `Security context: 0x35903c44a49 <JS Object>`,
      `1: walkFunctionDeclaration [<PROJECT_DIR>/node_modules/webpack/lib/Parser.js:~443] [pc=0xa07a14ec8ee] (this=0x59f67991119 <a Parser with map 0x71f2d115d49>,statement=0x3507a80af661 <a Node with map 0x71f2d1157c9>)`,
      `2: walkStatement [<PROJECT_DIR>/node_modules/webpack/lib/Parser.js:~348] [pc=0xa07a06dfc10] (this=0x59f6799111...`,
      ``,
      `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - process out of memory`,
      `Abort trap: 6`
    ].join('\n')
  };
  const ERROR_WITHOUT_MESSAGE_AND_STACK = {
    toString() {
      return 'Error: Stack overflow - out of memory';
    }
  };

  it.each([[ERROR_WITH_MESSAGE_AND_STACK], [ERROR_WITHOUT_MESSAGE_AND_STACK]])(
    'creates Issue from Internal Error: %p',
    error => {
      const issue = createIssueFromInternalError(error);

      expect(issue).toMatchSnapshot();
    }
  );
});
