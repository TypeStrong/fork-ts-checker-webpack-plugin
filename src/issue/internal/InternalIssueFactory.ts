import { Issue } from '../Issue';
import { IssueOrigin } from '../IssueOrigin';
import { IssueSeverity } from '../IssueSeverity';

interface ErrorLike {
  message?: string;
  stack?: string;
  toString?: () => string;
}

function createIssueFromInternalError(error: ErrorLike): Issue {
  return {
    origin: IssueOrigin.INTERNAL,
    severity: IssueSeverity.ERROR,
    code: 'INTERNAL',
    message:
      typeof error.message === 'string'
        ? error.message
        : (error.toString && error.toString()) || '',
    stack: typeof error.stack === 'string' ? error.stack : undefined
  };
}

export { createIssueFromInternalError };
