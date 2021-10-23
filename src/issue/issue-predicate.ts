import type { Issue } from './issue';

type IssuePredicate = (issue: Issue) => boolean;

function createTrivialIssuePredicate(result: boolean): IssuePredicate {
  return () => result;
}

function composeIssuePredicates(predicates: IssuePredicate[]): IssuePredicate {
  return (issue) => predicates.some((predicate) => predicate(issue));
}

export { IssuePredicate, createTrivialIssuePredicate, composeIssuePredicates };
