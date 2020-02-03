import webpack, { compilation } from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { OperationCancelledError } from '../reporter';
import { createWebpackFormatter } from '../formatter/WebpackFormatter';
import { Issue } from '../issue';
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
    let issues: Issue[];

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
      if (!(error instanceof OperationCancelledError)) {
        hooks.error.call(error, stats.compilation);
      } else {
        hooks.cancelled.call(stats.compilation);
      }
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

    const formatter = createWebpackFormatter(configuration.formatter);
    issues.forEach((issue) => {
      configuration.logger.issues.log(formatter(issue));
    });

    if (!issues.length) {
      configuration.logger.issues.log(chalk.green('No issues found.'));
    }

    if (stats.startTime) {
      configuration.logger.infrastructure.info(
        `Time: ${Math.round(Date.now() - stats.startTime).toString()} ms`
      );
    }
  });
}

export { tapDoneToAsyncGetIssues };
