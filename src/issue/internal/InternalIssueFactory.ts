import { Issue } from '../Issue';
import { IssueOrigin } from '../IssueOrigin';
import { IssueSeverity } from '../IssueSeverity';

function createIssueFromInternalError(error: any): Issue {
  return {
    origin: IssueOrigin.INTERNAL,
    severity: IssueSeverity.ERROR,
    code: 'INTERNAL',
    message:
      typeof error.message === 'string' ? error.message : error.toString(),
    stack: typeof error.stack === 'string' ? error.stack : undefined
  };
}

export { createIssueFromInternalError };
