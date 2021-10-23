import type * as webpack from 'webpack';

import type { IssueMatch } from './issue-match';
import { createIssuePredicateFromIssueMatch } from './issue-match';
import type { IssuePredicate } from './issue-predicate';
import { composeIssuePredicates, createTrivialIssuePredicate } from './issue-predicate';

type IssuePredicateOption = IssuePredicate | IssueMatch | (IssuePredicate | IssueMatch)[];
interface IssueOptions {
  include?: IssuePredicateOption;
  exclude?: IssuePredicateOption;
}
interface IssueConfig {
  predicate: IssuePredicate;
}

function createIssuePredicateFromOption(
  context: string,
  option: IssuePredicateOption
): IssuePredicate {
  if (Array.isArray(option)) {
    return composeIssuePredicates(
      option.map((option) =>
        typeof option === 'function' ? option : createIssuePredicateFromIssueMatch(context, option)
      )
    );
  }

  return typeof option === 'function'
    ? option
    : createIssuePredicateFromIssueMatch(context, option);
}

function createIssueConfig(
  compiler: webpack.Compiler,
  options: IssueOptions | undefined
): IssueConfig {
  const context = compiler.options.context || process.cwd();

  if (!options) {
    options = {} as IssueOptions;
  }

  const include = options.include
    ? createIssuePredicateFromOption(context, options.include)
    : createTrivialIssuePredicate(true);
  const exclude = options.exclude
    ? createIssuePredicateFromOption(context, options.exclude)
    : createTrivialIssuePredicate(false);

  return {
    predicate: (issue) => include(issue) && !exclude(issue),
  };
}

export { IssueOptions, IssuePredicateOption, IssueConfig, createIssueConfig };
