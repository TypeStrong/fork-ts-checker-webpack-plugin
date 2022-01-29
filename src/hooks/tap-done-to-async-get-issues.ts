import chalk from 'chalk';
import type webpack from 'webpack';

import { createWebpackFormatter } from '../formatter/webpack-formatter';
import { getInfrastructureLogger } from '../infrastructure-logger';
import type { Issue } from '../issue';
import { IssueWebpackError } from '../issue/issue-webpack-error';
import type { ForkTsCheckerWebpackPluginConfig } from '../plugin-config';
import { getPluginHooks } from '../plugin-hooks';
import type { ForkTsCheckerWebpackPluginState } from '../plugin-state';
import { isPending } from '../utils/async/is-pending';
import { wait } from '../utils/async/wait';

function tapDoneToAsyncGetIssues(
  compiler: webpack.Compiler,
  config: ForkTsCheckerWebpackPluginConfig,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getPluginHooks(compiler);
  const { log, debug } = getInfrastructureLogger(compiler);

  compiler.hooks.done.tap('ForkTsCheckerWebpackPlugin', async (stats) => {
    if (stats.compilation.compiler !== compiler) {
      // run only for the compiler that the plugin was registered for
      return;
    }

    const issuesPromise = state.issuesPromise;
    let issues: Issue[] | undefined;

    try {
      if (await isPending(issuesPromise)) {
        hooks.waiting.call(stats.compilation);
        config.logger.log(chalk.cyan('Issues checking in progress...'));
      } else {
        // wait 10ms to log issues after webpack stats
        await wait(10);
      }

      issues = await issuesPromise;
      debug('Got issues from getIssuesWorker.', issues?.length);
    } catch (error) {
      hooks.error.call(error, stats.compilation);
      return;
    }

    if (!issues) {
      // some error has been thrown or it was canceled
      return;
    }

    // filter list of issues by provided issue predicate
    issues = issues.filter(config.issue.predicate);

    // modify list of issues in the plugin hooks
    issues = hooks.issues.call(issues, stats.compilation);

    const formatter = createWebpackFormatter(config.formatter);

    if (issues.length) {
      // follow webpack's approach - one process.write to stderr with all errors and warnings
      config.logger.error(issues.map((issue) => formatter(issue)).join('\n'));
    } else {
      config.logger.log(chalk.green('No issues found.'));
    }

    // report issues to webpack-dev-server, if it's listening
    // skip reporting if there are no issues, to avoid an extra hot reload
    if (issues.length && state.webpackDevServerDoneTap) {
      issues.forEach((issue) => {
        const error = new IssueWebpackError(config.formatter(issue), issue);

        if (issue.severity === 'warning') {
          stats.compilation.warnings.push(error);
        } else {
          stats.compilation.errors.push(error);
        }
      });

      debug('Sending issues to the webpack-dev-server.');
      state.webpackDevServerDoneTap.fn(stats);
    }

    if (stats.startTime) {
      log(`Time: ${Math.round(Date.now() - stats.startTime).toString()} ms`);
    }
  });
}

export { tapDoneToAsyncGetIssues };
