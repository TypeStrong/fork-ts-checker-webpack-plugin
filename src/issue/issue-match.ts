import path from 'path';

import { forwardSlash } from '../utils/path/forward-slash';
import { matchGlob } from '../utils/path/match-glob';

import type { IssuePredicate } from './issue-predicate';

import type { Issue } from './index';

type IssueMatch = Partial<Pick<Issue, 'severity' | 'code' | 'file'>>;

function createIssuePredicateFromIssueMatch(context: string, match: IssueMatch): IssuePredicate {
  return (issue) => {
    const matchesSeverity = !match.severity || match.severity === issue.severity;
    const matchesCode = !match.code || match.code === issue.code;
    const matchesFile =
      !issue.file ||
      (!!issue.file &&
        (!match.file || matchGlob(forwardSlash(path.relative(context, issue.file)), match.file)));

    return matchesSeverity && matchesCode && matchesFile;
  };
}

export { IssueMatch, createIssuePredicateFromIssueMatch };
