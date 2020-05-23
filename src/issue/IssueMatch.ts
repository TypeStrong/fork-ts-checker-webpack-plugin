import { Issue } from './index';
import { IssuePredicate } from './IssuePredicate';
import minimatch from 'minimatch';
import path from 'path';
import normalizeSlash from '../utils/path/normalizeSlash';

type IssueMatch = Partial<Pick<Issue, 'origin' | 'severity' | 'code' | 'file'>>;

function createIssuePredicateFromIssueMatch(context: string, match: IssueMatch): IssuePredicate {
  return (issue) => {
    const matchesOrigin = !match.origin || match.origin === issue.origin;
    const matchesSeverity = !match.severity || match.severity === issue.severity;
    const matchesCode = !match.code || match.code === issue.code;
    const matchesFile =
      !issue.file ||
      (!!issue.file &&
        (!match.file || minimatch(normalizeSlash(path.relative(context, issue.file)), match.file)));

    return matchesOrigin && matchesSeverity && matchesCode && matchesFile;
  };
}

export { IssueMatch, createIssuePredicateFromIssueMatch };
