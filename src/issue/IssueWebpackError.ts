import { relative } from 'path';
import { Issue } from './Issue';
import { formatIssueLocation } from './IssueLocation';
import normalizeSlash from '../utils/path/normalizeSlash';

class IssueWebpackError extends Error {
  readonly hideStack = true;
  readonly file: string | undefined;

  constructor(message: string, context: string, readonly issue: Issue) {
    super(message);

    // to display issue location using `loc` property, webpack requires `error.module` which
    // should be a NormalModule instance.
    // to avoid such a dependency, we do a workaround - error.file will contain formatted location instead
    if (issue.file) {
      const parts = [normalizeSlash(relative(context, issue.file))];
      if (issue.location) {
        parts.push(formatIssueLocation(issue.location));
      }
      this.file = parts.join(' ');
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

export { IssueWebpackError };
