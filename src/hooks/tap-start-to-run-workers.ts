import type * as webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginConfig } from '../config';
import type { FilesChange } from '../files-change';
import { getFilesChange } from '../files-change';
import { getPluginHooks } from '../plugin-hooks';
import { dependenciesPool, issuesPool } from '../plugin-pools';
import type { ForkTsCheckerWebpackPluginState } from '../state';
import type { GetDependenciesWorker } from '../typescript/worker/get-dependencies-worker';
import type { GetIssuesWorker } from '../typescript/worker/get-issues-worker';
import type { RpcWorker } from '../utils/rpc';

import { interceptDoneForDevServerTap } from './intercept-done-for-dev-server-tap';
import { tapAfterCompileToGetIssues } from './tap-after-compile-to-get-issues';
import { tapDoneToAsyncGetIssues } from './tap-done-to-async-get-issues';

function tapStartToRunWorkers(
  compiler: webpack.Compiler,
  getIssuesWorker: RpcWorker<GetIssuesWorker>,
  getDependenciesWorker: RpcWorker<GetDependenciesWorker>,
  config: ForkTsCheckerWebpackPluginConfig,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getPluginHooks(compiler);

  compiler.hooks.run.tap('ForkTsCheckerWebpackPlugin', () => {
    if (!state.initialized) {
      state.initialized = true;

      state.watching = false;
      tapAfterCompileToGetIssues(compiler, config, state);
    }
  });

  compiler.hooks.watchRun.tap('ForkTsCheckerWebpackPlugin', async () => {
    if (!state.initialized) {
      state.initialized = true;

      state.watching = true;
      if (config.async) {
        tapDoneToAsyncGetIssues(compiler, config, state);
        interceptDoneForDevServerTap(compiler, state);
      } else {
        tapAfterCompileToGetIssues(compiler, config, state);
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

      compiler
        .getInfrastructureLogger('ForkTsCheckerWebpackPlugin')
        .log(
          [
            'Calling reporter service for incremental check.',
            `  Changed files: ${JSON.stringify(change.changedFiles)}`,
            `  Deleted files: ${JSON.stringify(change.deletedFiles)}`,
          ].join('\n')
        );
    } else {
      compiler
        .getInfrastructureLogger('ForkTsCheckerWebpackPlugin')
        .log('Calling reporter service for single check.');
    }

    change = await hooks.start.promise(change, compilation);

    state.issuesPromise = issuesPool.submit(async () => {
      try {
        return await getIssuesWorker.call(change, state.watching);
      } catch (error) {
        hooks.error.call(error, compilation);
        return undefined;
      }
    });
    state.dependenciesPromise = dependenciesPool.submit(async () => {
      try {
        return await getDependenciesWorker.call(change);
      } catch (error) {
        hooks.error.call(error, compilation);
        return undefined;
      }
    });
  });
}

export { tapStartToRunWorkers };
