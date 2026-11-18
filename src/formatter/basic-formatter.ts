import chalk from 'chalk';

import type { Formatter } from './formatter';

function createBasicFormatter(): Formatter {
  return function basicFormatter(issue) {
    return chalk.gray(issue.code + ': ') + issue.message;
  };
}

export { createBasicFormatter };
