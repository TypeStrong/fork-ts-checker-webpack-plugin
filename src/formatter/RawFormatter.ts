import { Formatter } from './Formatter';
import { IssueOrigin } from '../issue';

function createRawFormatter(): Formatter {
  return function rawFormatter(issue) {
    const code =
      issue.origin === IssueOrigin.TYPESCRIPT ? `TS${issue.code}` : issue.code;

    return `${issue.severity.toUpperCase()} ${code}: ${issue.message}`;
  };
}

export { createRawFormatter };
