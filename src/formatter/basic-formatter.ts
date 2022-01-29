import chalk from 'chalk';

import type { Formatter } from './formatter';

function createBasicFormatter(): Formatter {
  return function basicFormatter(issue) {
    return chalk.grey(issue.code + ': ') + issue.message;
  };
}

export { createBasicFormatter };
