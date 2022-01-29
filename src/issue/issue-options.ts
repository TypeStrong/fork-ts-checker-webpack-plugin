import type { IssueMatch } from './issue-match';
import type { IssuePredicate } from './issue-predicate';

type IssuePredicateOption = IssuePredicate | IssueMatch | (IssuePredicate | IssueMatch)[];

interface IssueOptions {
  include?: IssuePredicateOption;
  exclude?: IssuePredicateOption;
}

export { IssueOptions, IssuePredicateOption };
