import { relative } from 'path';
import { Issue } from './Issue';
import { IssueLocation } from './IssueLocation';

interface IssueWebpackErrorLoc {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

function formatFile(file: string, context: string) {
  return relative(context, file);
}

function formatLocation(location: IssueLocation) {
  return [
    `${location.start.line}:${location.start.column}`,
    location.start.line !== location.end.line
      ? `${location.end.line}:${location.end.column}`
      : `${location.end.column}`,
  ].join('-');
}

class IssueWebpackError extends Error {
  readonly hideStack = true;
  readonly file: string | undefined;

  constructor(message: string, context: string, readonly issue: Issue) {
    super(message);

    // to display issue location using `loc` property, webpack requires `error.module` which
    // should be a NormalModule instance.
    // to avoid such a dependency, we do a workaround - error.file will contain formatted location instead
    if (issue.file) {
      const parts = [formatFile(issue.file, context)];
      if (issue.location) {
        parts.push(formatLocation(issue.location));
      }
      this.file = parts.join(' ');
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

export { IssueWebpackError };
