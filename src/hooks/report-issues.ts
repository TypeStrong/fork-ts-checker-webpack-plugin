import type * as webpack from 'webpack';

import type { Issue } from '../issue';
import { IssueWebpackError } from '../issue/issue-webpack-error';
import type { ForkTsCheckerWebpackPluginConfig } from '../plugin-config';
import { getPluginHooks } from '../plugin-hooks';

/** Applies the `issue` option's predicate, then lets the plugin hooks modify the list. */
function getIssuesToReport(
  issues: Issue[],
  compilation: webpack.Compilation,
  config: ForkTsCheckerWebpackPluginConfig
): Issue[] {
  return getPluginHooks(compilation.compiler).issues.call(
    issues.filter(config.issue.predicate),
    compilation
  );
}

/** Adds the issues to the compilation as webpack errors and warnings. */
function addIssuesToCompilation(
  issues: Issue[],
  compilation: webpack.Compilation,
  config: ForkTsCheckerWebpackPluginConfig
) {
  for (const issue of issues) {
    const error = new IssueWebpackError(
      config.formatter.format(issue),
      config.formatter.pathType,
      issue
    );

    if (issue.severity === 'warning') {
      compilation.warnings.push(error);
    } else {
      compilation.errors.push(error);
    }
  }
}

export { getIssuesToReport, addIssuesToCompilation };
