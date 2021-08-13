import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { FilesMatch, FilesChange, getFilesChange, ReporterRpcClient } from '../reporter';
import { OperationCanceledError } from '../error/OperationCanceledError';
import { tapDoneToAsyncGetIssues } from './tapDoneToAsyncGetIssues';
import { tapAfterCompileToGetIssues } from './tapAfterCompileToGetIssues';
import { interceptDoneToGetWebpackDevServerTap } from './interceptDoneToGetWebpackDevServerTap';
import { Issue } from '../issue';
import { ForkTsCheckerWebpackPlugin } from '../ForkTsCheckerWebpackPlugin';

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

      configuration.logger.infrastructure.info(
        [
          'Calling reporter service for incremental check.',
          `  Changed files: ${JSON.stringify(change.changedFiles)}`,
          `  Deleted files: ${JSON.stringify(change.deletedFiles)}`,
        ].join('\n')
      );
    } else {
      configuration.logger.infrastructure.info('Calling reporter service for single check.');
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

    state.issuesReportPromise = ForkTsCheckerWebpackPlugin.issuesPool.submit(
      (done) =>
        new Promise(async (resolve) => {
          try {
            await issuesReporter.connect();

            const previousReport = await previousIssuesReportPromise;
            if (previousReport) {
              await previousReport.close();
            }

            const report = await issuesReporter.getReport(change);
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
    state.dependenciesReportPromise = ForkTsCheckerWebpackPlugin.dependenciesPool.submit(
      (done) =>
        new Promise(async (resolve) => {
          try {
            await dependenciesReporter.connect();

            const previousReport = await previousDependenciesReportPromise;
            if (previousReport) {
              await previousReport.close();
            }

            const report = await dependenciesReporter.getReport(change);
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
