import path from 'path';

import * as webpack from 'webpack';

import type { FormatterPathType } from '../formatter';
import { forwardSlash } from '../utils/path/forward-slash';
import { relativeToContext } from '../utils/path/relative-to-context';

import type { Issue } from './issue';
import { formatIssueLocation } from './issue-location';

class IssueWebpackError extends webpack.WebpackError {
  readonly hideStack = true;

  constructor(message: string, pathType: FormatterPathType, readonly issue: Issue) {
    super(message);

    // to display issue location using `loc` property, webpack requires `error.module` which
    // should be a NormalModule instance.
    // to avoid such a dependency, we do a workaround - error.file will contain formatted location instead
    if (issue.file) {
      this.file =
        pathType === 'absolute'
          ? forwardSlash(path.resolve(issue.file))
          : relativeToContext(issue.file, process.cwd());

      if (issue.location) {
        this.file += `:${formatIssueLocation(issue.location)}`;
      }
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

export { IssueWebpackError };
