import chalk from 'chalk';
import webpack from 'webpack';

import { relativeToContext } from '../utils/path/relative-to-context';

import type { Issue } from './issue';
import { formatIssueLocation } from './issue-location';

class IssueWebpackError extends webpack.WebpackError {
  readonly hideStack = true;

  constructor(message: string, readonly issue: Issue) {
    super(message);

    // to display issue location using `loc` property, webpack requires `error.module` which
    // should be a NormalModule instance.
    // to avoid such a dependency, we do a workaround - error.file will contain formatted location instead
    if (issue.file) {
      this.file = relativeToContext(issue.file, process.cwd());

      if (issue.location) {
        this.file += `:${chalk.green.bold(formatIssueLocation(issue.location))}`;
      }
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

export { IssueWebpackError };
