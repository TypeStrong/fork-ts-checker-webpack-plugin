import chalk from 'chalk';
import * as os from 'os';

import { IssueOrigin } from '../issue';
import { Formatter } from './Formatter';

/**
 * TODO: maybe we should not treat internal errors as issues
 */
function createInternalFormatter(): Formatter {
  return function internalFormatter(issue) {
    const color = {
      message: chalk.bold.red,
      stack: chalk.grey
    };

    if (issue.origin === IssueOrigin.INTERNAL) {
      const lines = [
        `${color.message('INTERNAL ' + issue.severity.toUpperCase())}: ${
          issue.message
        }`
      ];
      if (issue.stack) {
        lines.push('stack trace:', color.stack(issue.stack));
      }

      return lines.join(os.EOL);
    } else {
      throw new Error(`Not supported "${issue.origin}" issue origin.`);
    }
  };
}

export { createInternalFormatter };
