import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { getDeletedFiles } from './getDeletedFiles';
import { FilesChange, ReporterRpcClient } from '../reporter';
import { getChangedFiles } from './getChangedFiles';
import { OperationCanceledError } from '../error/OperationCanceledError';
import { tapDoneToAsyncGetIssues } from './tapDoneToAsyncGetIssues';
import { tapAfterCompileToGetIssues } from './tapAfterCompileToGetIssues';
import { interceptDoneToGetWebpackDevServerTap } from './interceptDoneToGetWebpackDevServerTap';

function tapStartToConnectAndRunReporter(
  compiler: webpack.Compiler,
  reporter: ReporterRpcClient,
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
      change = {
        changedFiles: getChangedFiles(compilation.compiler),
        deletedFiles: getDeletedFiles(compilation.compiler, state),
      };

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

    state.report = new Promise(async (resolve) => {
      change = await hooks.start.promise(change, compilation);

      try {
        await reporter.connect();
        const report = await reporter.getReport(change);

        resolve(report);
      } catch (error) {
        if (error instanceof OperationCanceledError) {
          hooks.canceled.call(compilation);
        } else {
          hooks.error.call(error, compilation);
        }

        resolve(undefined);
      }
    });
  });
}

export { tapStartToConnectAndRunReporter };
