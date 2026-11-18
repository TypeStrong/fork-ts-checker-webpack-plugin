import pc from 'picocolors';

import type { Formatter } from './formatter';

function createBasicFormatter(): Formatter {
  return function basicFormatter(issue) {
    return pc.gray(issue.code + ': ') + issue.message;
  };
}

export { createBasicFormatter };
