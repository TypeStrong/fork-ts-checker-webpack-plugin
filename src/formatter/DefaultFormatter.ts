import * as os from 'os';
import chalk from 'chalk';

import { IssueSeverity, IssueOrigin } from '../issue';
import { Formatter } from './Formatter';
import { createInternalFormatter } from './InternalFormatter';

function createDefaultFormatter(): Formatter {
  return function defaultFormatter(issue) {
    const color = {
      message:
        issue.severity === IssueSeverity.WARNING
          ? chalk.bold.yellow
          : chalk.bold.red,
      position: chalk.bold.cyan,
      code: chalk.grey
    };

    if (issue.origin === IssueOrigin.INTERNAL) {
      return createInternalFormatter()(issue);
    }

    const code =
      issue.origin === IssueOrigin.TYPESCRIPT ? `TS${issue.code}` : issue.code;

    return [
      color.message(`${issue.severity.toUpperCase()} in `) +
        color.position(`${issue.file}(${issue.line},${issue.character})`) +
        color.message(':'),
      color.code(code + ': ') + issue.message
    ].join(os.EOL);
  };
}

export { createDefaultFormatter };
