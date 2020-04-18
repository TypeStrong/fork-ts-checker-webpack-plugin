import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { OperationCancelledError } from '../error/OperationCancelledError';
import { IssueWebpackError } from '../issue/IssueWebpackError';
import { Tap } from 'tapable';
import { getReportProgress } from './getReportProgress';
import { Issue } from '../issue';

function tapAfterCompileToGetIssues(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getForkTsCheckerWebpackPluginHooks(compiler);

  compiler.hooks.afterCompile.tapPromise(
    {
      name: 'ForkTsCheckerWebpackPlugin',
      context: true,
    } as Tap,
    async (context, compilation) => {
      const reportProgress = getReportProgress(context);
      let issues: Issue[] = [];

      try {
        if (reportProgress) {
          reportProgress(0.95, 'Issues checking in progress');
        }

        issues = await state.report;
      } catch (error) {
        if (error instanceof OperationCancelledError) {
          hooks.cancelled.call(compilation);
        } else {
          hooks.error.call(error, compilation);
        }
        return;
      } finally {
        if (reportProgress) {
          reportProgress(0.95, 'Issues checked');
        }
      }

      // filter list of issues by provided issue predicate
      issues = issues.filter(configuration.issue.predicate);

      // modify list of issues in the plugin hooks
      issues = hooks.issues.call(issues, compilation);

      issues.forEach((issue) => {
        const error = new IssueWebpackError(
          configuration.formatter(issue),
          compiler.options.context || process.cwd(),
          issue
        );

        if (issue.severity === 'warning') {
          compilation.warnings.push(error);
        } else {
          compilation.errors.push(error);
        }
      });
    }
  );
}

export { tapAfterCompileToGetIssues };
