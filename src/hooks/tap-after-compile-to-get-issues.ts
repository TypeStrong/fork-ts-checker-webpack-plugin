import type * as webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginConfig } from '../config';
import type { Issue } from '../issue';
import { IssueWebpackError } from '../issue/issue-webpack-error';
import { getPluginHooks } from '../plugin-hooks';
import type { ForkTsCheckerWebpackPluginState } from '../state';

function tapAfterCompileToGetIssues(
  compiler: webpack.Compiler,
  config: ForkTsCheckerWebpackPluginConfig,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getPluginHooks(compiler);

  compiler.hooks.afterCompile.tapPromise('ForkTsCheckerWebpackPlugin', async (compilation) => {
    if (compilation.compiler !== compiler) {
      // run only for the compiler that the plugin was registered for
      return;
    }

    let issues: Issue[] | undefined = [];

    try {
      issues = await state.issuesPromise;
    } catch (error) {
      hooks.error.call(error, compilation);
      return;
    }

    if (!issues) {
      // some error has been thrown or it was canceled
      return;
    }

    // filter list of issues by provided issue predicate
    issues = issues.filter(config.issue.predicate);

    // modify list of issues in the plugin hooks
    issues = hooks.issues.call(issues, compilation);

    issues.forEach((issue) => {
      const error = new IssueWebpackError(config.formatter(issue), issue);

      if (issue.severity === 'warning') {
        compilation.warnings.push(error);
      } else {
        compilation.errors.push(error);
      }
    });
  });
}

export { tapAfterCompileToGetIssues };
