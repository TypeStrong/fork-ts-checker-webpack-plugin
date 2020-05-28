import { relative } from 'path';
import { Issue } from './Issue';
import { formatIssueLocation } from './IssueLocation';
import forwardSlash from '../utils/path/forwardSlash';

class IssueWebpackError extends Error {
  readonly hideStack = true;
  readonly file: string | undefined;

  constructor(message: string, context: string, readonly issue: Issue) {
    super(message);

    // to display issue location using `loc` property, webpack requires `error.module` which
    // should be a NormalModule instance.
    // to avoid such a dependency, we do a workaround - error.file will contain formatted location instead
    if (issue.file) {
      this.file = forwardSlash(relative(context, issue.file));

      if (issue.location) {
        this.file += ` ${formatIssueLocation(issue.location)}`;
      }
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

export { IssueWebpackError };
