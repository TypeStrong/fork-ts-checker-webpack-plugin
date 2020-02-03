import chalk from 'chalk';
import { Formatter } from './Formatter';

function createBasicFormatter(): Formatter {
  return function basicFormatter(issue) {
    return chalk.grey(issue.code + ': ') + issue.message;
  };
}

export { createBasicFormatter };
