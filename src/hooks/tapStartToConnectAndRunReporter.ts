import type webpack from 'webpack';

import { OperationCanceledError } from '../error/OperationCanceledError';
import type { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import type { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import type { Issue } from '../issue';
import type { FilesMatch, FilesChange, ReporterRpcClient } from '../reporter';
import { getFilesChange } from '../reporter';

import { interceptDoneToGetWebpackDevServerTap } from './interceptDoneToGetWebpackDevServerTap';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { dependenciesPool, issuesPool } from './pluginPools';
import { tapAfterCompileToGetIssues } from './tapAfterCompileToGetIssues';
import { tapDoneToAsyncGetIssues } from './tapDoneToAsyncGetIssues';

function tapStartToConnectAndRunReporter(
  compiler: webpack.Compiler,
  issuesReporter: ReporterRpcClient,
  dependenciesReporter: ReporterRpcClient,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getForkTsCheckerWebpackPluginHooks(compiler);

  compiler.hooks.run.tap('ForkTsCheckerWebpackPlugin', () => {
    if (!state.initialized) {
      state.initialized = true;

      state.watching = false;
      tapAfterCompileToGetIssues(compiler, configuration, state);
    }
  });

  compiler.hooks.watchRun.tap('ForkTsCheckerWebpackPlugin', async () => {
    if (!state.initialized) {
      state.initialized = true;

      state.watching = true;
      if (configuration.async) {
        tapDoneToAsyncGetIssues(compiler, configuration, state);
        interceptDoneToGetWebpackDevServerTap(compiler, configuration, state);
      } else {
        tapAfterCompileToGetIssues(compiler, configuration, state);
      }
    }
  });

  compiler.hooks.compilation.tap('ForkTsCheckerWebpackPlugin', async (compilation) => {
    if (compilation.compiler !== compiler) {
      // run only for the compiler that the plugin was registered for
      return;
    }

    let change: FilesChange = {};

    if (state.watching) {
      change = getFilesChange(compiler);

      configuration.logger.infrastructure.log(
        [
          'Calling reporter service for incremental check.',
          `  Changed files: ${JSON.stringify(change.changedFiles)}`,
          `  Deleted files: ${JSON.stringify(change.deletedFiles)}`,
        ].join('\n')
      );
    } else {
      configuration.logger.infrastructure.log('Calling reporter service for single check.');
    }

    let resolveDependencies: (dependencies: FilesMatch | undefined) => void;
    let rejectDependencies: (error: Error) => void;
    let resolveIssues: (issues: Issue[] | undefined) => void;
    let rejectIssues: (error: Error) => void;

    state.dependenciesPromise = new Promise((resolve, reject) => {
      resolveDependencies = resolve;
      rejectDependencies = reject;
    });
    state.issuesPromise = new Promise((resolve, reject) => {
      resolveIssues = resolve;
      rejectIssues = reject;
    });
    const previousIssuesReportPromise = state.issuesReportPromise;
    const previousDependenciesReportPromise = state.dependenciesReportPromise;

    change = await hooks.start.promise(change, compilation);

    state.issuesReportPromise = issuesPool.submit(
      (done) =>
        // eslint-disable-next-line no-async-promise-executor
        new Promise(async (resolve) => {
          try {
            await issuesReporter.connect();

            const previousReport = await previousIssuesReportPromise;
            if (previousReport) {
              await previousReport.close();
            }

            const report = await issuesReporter.getReport(change, state.watching);
            resolve(report);

            report.getIssues().then(resolveIssues).catch(rejectIssues).finally(done);
          } catch (error) {
            if (error instanceof OperationCanceledError) {
              hooks.canceled.call(compilation);
            } else {
              hooks.error.call(error, compilation);
            }

            resolve(undefined);
            resolveIssues(undefined);
            done();
          }
        })
    );
    state.dependenciesReportPromise = dependenciesPool.submit(
      (done) =>
        // eslint-disable-next-line no-async-promise-executor
        new Promise(async (resolve) => {
          try {
            await dependenciesReporter.connect();

            const previousReport = await previousDependenciesReportPromise;
            if (previousReport) {
              await previousReport.close();
            }

            const report = await dependenciesReporter.getReport(change, state.watching);
            resolve(report);

            report
              .getDependencies()
              .then(resolveDependencies)
              .catch(rejectDependencies)
              .finally(done);
          } catch (error) {
            if (error instanceof OperationCanceledError) {
              hooks.canceled.call(compilation);
            } else {
              hooks.error.call(error, compilation);
            }

            resolve(undefined);
            resolveDependencies(undefined);
            done();
          }
        })
    );
  });
}

export { tapStartToConnectAndRunReporter };
