import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { getDeletedFiles } from './getDeletedFiles';
import { FilesChange, ReporterRpcClient } from '../reporter';

function tapStartToConnectAndRunReporter(
  compiler: webpack.Compiler,
  reporter: ReporterRpcClient,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getForkTsCheckerWebpackPluginHooks(compiler);

  compiler.hooks.run.tap('ForkTsCheckerWebpackPlugin', (compiler) => {
    state.isWatching = false;

    configuration.logger.infrastructure.info('Calling reporter service for single check.');

    hooks.run.call(compiler);

    state.report = reporter.connect().then(() => reporter.getReport({}));
  });

  compiler.hooks.watchRun.tap('ForkTsCheckerWebpackPlugin', async (compiler) => {
    state.isWatching = true;

    let change: FilesChange = {
      createdFiles: state.createdFiles,
      changedFiles: state.changedFiles,
      deletedFiles: getDeletedFiles(compiler),
    };

    state.createdFiles = [];
    state.changedFiles = [];

    change = hooks.runWatch.call(change, compiler);

    configuration.logger.infrastructure.info(
      [
        'Calling reporter service for incremental check.',
        `  Created files: ${JSON.stringify(change.createdFiles)}`,
        `  Changed files: ${JSON.stringify(change.changedFiles)}`,
        `  Deleted files: ${JSON.stringify(change.deletedFiles)}`,
      ].join('\n')
    );

    state.report = reporter.connect().then(() => reporter.getReport(change));
  });
}

export { tapStartToConnectAndRunReporter };
