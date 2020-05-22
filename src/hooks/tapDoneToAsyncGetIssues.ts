import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { createWebpackFormatter } from '../formatter/WebpackFormatter';
import { Issue } from '../issue';
import { IssueWebpackError } from '../issue/IssueWebpackError';
import isPending from '../utils/async/isPending';
import wait from '../utils/async/wait';
import chalk from 'chalk';

function tapDoneToAsyncGetIssues(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getForkTsCheckerWebpackPluginHooks(compiler);

  compiler.hooks.done.tap('ForkTsCheckerWebpackPlugin', async (stats) => {
    const report = state.report;
    let issues: Issue[] | undefined;

    try {
      if (await isPending(report)) {
        hooks.waiting.call(stats.compilation);
        configuration.logger.issues.log(chalk.blue('Issues checking in progress...'));
      } else {
        // wait 10ms to log issues after webpack stats
        await wait(10);
      }

      issues = await report;
    } catch (error) {
      hooks.error.call(error, stats.compilation);
      return;
    }

    if (!issues) {
      // some error has been thrown or it was canceled
      return;
    }

    if (report !== state.report) {
      // there is a newer report - ignore this one
      return;
    }

    // filter list of issues by provided issue predicate
    issues = issues.filter(configuration.issue.predicate);

    // modify list of issues in the plugin hooks
    issues = hooks.issues.call(issues);

    const formatter = createWebpackFormatter(configuration.formatter, compiler.context);

    if (issues.length) {
      // follow webpack's approach - one process.write to stderr with all errors and warnings
      configuration.logger.issues.error(issues.map((issue) => formatter(issue)).join('\n'));
    } else {
      configuration.logger.issues.log(chalk.green('No issues found.'));
    }

    if (state.webpackDevServerDoneTap) {
      issues.forEach((issue) => {
        const error = new IssueWebpackError(
          configuration.formatter(issue),
          compiler.options.context || process.cwd(),
          issue
        );

        if (issue.severity === 'warning') {
          stats.compilation.warnings.push(error);
        } else {
          stats.compilation.errors.push(error);
        }
      });

      state.webpackDevServerDoneTap.fn(stats);
    }

    if (stats.startTime) {
      configuration.logger.infrastructure.info(
        `Time: ${Math.round(Date.now() - stats.startTime).toString()} ms`
      );
    }
  });
}

export { tapDoneToAsyncGetIssues };
