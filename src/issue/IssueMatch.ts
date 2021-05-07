import { Issue } from './index';
import { IssuePredicate } from './IssuePredicate';
import minimatch from 'minimatch';
import path from 'path';
import forwardSlash from '../utils/path/forwardSlash';

type IssueMatch = Partial<Pick<Issue, 'severity' | 'code' | 'file'>>;

function createIssuePredicateFromIssueMatch(context: string, match: IssueMatch): IssuePredicate {
  return (issue) => {
    const matchesSeverity = !match.severity || match.severity === issue.severity;
    const matchesCode = !match.code || match.code === issue.code;
    const matchesFile =
      !issue.file ||
      (!!issue.file &&
        (!match.file || minimatch(forwardSlash(path.relative(context, issue.file)), match.file)));

    return matchesSeverity && matchesCode && matchesFile;
  };
}

export { IssueMatch, createIssuePredicateFromIssueMatch };
