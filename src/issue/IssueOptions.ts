import { IssueMatch } from './IssueMatch';
import { IssuePredicate } from './IssuePredicate';

type IssuePredicateOption = IssuePredicate | IssueMatch | (IssuePredicate | IssueMatch)[];

interface IssueOptions {
  include?: IssuePredicateOption;
  exclude?: IssuePredicateOption;
}

export { IssueOptions, IssuePredicateOption };
