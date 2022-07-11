import { AbortController } from 'node-abort-controller';
import type * as webpack from 'webpack';

import type { FilesChange } from '../files-change';
import { aggregateFilesChanges, consumeFilesChange } from '../files-change';
import { getInfrastructureLogger } from '../infrastructure-logger';
import type { ForkTsCheckerWebpackPluginConfig } from '../plugin-config';
import { getPluginHooks } from '../plugin-hooks';
import { dependenciesPool, issuesPool } from '../plugin-pools';
import type { ForkTsCheckerWebpackPluginState } from '../plugin-state';
import type { RpcWorker } from '../rpc';
import type { GetDependenciesWorker } from '../typescript/worker/get-dependencies-worker';
import type { GetIssuesWorker } from '../typescript/worker/get-issues-worker';

import { interceptDoneToGetDevServerTap } from './intercept-done-to-get-dev-server-tap';
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
  const { log, debug } = getInfrastructureLogger(compiler);

  compiler.hooks.run.tap('ForkTsCheckerWebpackPlugin', () => {
    if (!state.initialized) {
      debug('Initializing plugin for single run (not async).');
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
        debug('Initializing plugin for watch run (async).');

        tapDoneToAsyncGetIssues(compiler, config, state);
        interceptDoneToGetDevServerTap(compiler, config, state);
      } else {
        debug('Initializing plugin for watch run (not async).');

        tapAfterCompileToGetIssues(compiler, config, state);
      }
    }
  });

  compiler.hooks.compilation.tap('ForkTsCheckerWebpackPlugin', async (compilation) => {
    if (compilation.compiler !== compiler) {
      // run only for the compiler that the plugin was registered for
      return;
    }

    // get current iteration number
    const iteration = ++state.iteration;

    // abort previous iteration
    if (state.abortController) {
      debug(`Aborting iteration ${iteration - 1}.`);
      state.abortController.abort();
    }

    // create new abort controller for the new iteration
    const abortController = new AbortController();
    state.abortController = abortController;

    let filesChange: FilesChange = {};

    if (state.watching) {
      filesChange = consumeFilesChange(compiler);
      log(
        [
          'Calling reporter service for incremental check.',
          `  Changed files: ${JSON.stringify(filesChange.changedFiles)}`,
          `  Deleted files: ${JSON.stringify(filesChange.deletedFiles)}`,
        ].join('\n')
      );
    } else {
      log('Calling reporter service for single check.');
    }

    filesChange = await hooks.start.promise(filesChange, compilation);
    let aggregatedFilesChange = filesChange;
    if (state.aggregatedFilesChange) {
      aggregatedFilesChange = aggregateFilesChanges([aggregatedFilesChange, filesChange]);
      debug(
        [
          `Aggregating with previous files change, iteration ${iteration}.`,
          `  Changed files: ${JSON.stringify(aggregatedFilesChange.changedFiles)}`,
          `  Deleted files: ${JSON.stringify(aggregatedFilesChange.deletedFiles)}`,
        ].join('\n')
      );
    }
    state.aggregatedFilesChange = aggregatedFilesChange;

    // submit one at a time for a single compiler
    state.issuesPromise = (state.issuesPromise || Promise.resolve())
      // resolve to undefined on error
      .catch(() => undefined)
      .then(() => {
        // early return
        if (abortController.signal.aborted) {
          return undefined;
        }

        debug(`Submitting the getIssuesWorker to the pool, iteration ${iteration}.`);
        return issuesPool.submit(async () => {
          try {
            debug(`Running the getIssuesWorker, iteration ${iteration}.`);
            const issues = await getIssuesWorker(aggregatedFilesChange, state.watching);
            if (state.aggregatedFilesChange === aggregatedFilesChange) {
              state.aggregatedFilesChange = undefined;
            }
            if (state.abortController === abortController) {
              state.abortController = undefined;
            }
            return issues;
          } catch (error) {
            hooks.error.call(error, compilation);
            return undefined;
          } finally {
            debug(`The getIssuesWorker finished its job, iteration ${iteration}.`);
          }
        }, abortController.signal);
      });

    debug(`Submitting the getDependenciesWorker to the pool, iteration ${iteration}.`);
    state.dependenciesPromise = dependenciesPool.submit(async () => {
      try {
        debug(`Running the getDependenciesWorker, iteration ${iteration}.`);
        return await getDependenciesWorker(filesChange);
      } catch (error) {
        hooks.error.call(error, compilation);
        return undefined;
      } finally {
        debug(`The getDependenciesWorker finished its job, iteration ${iteration}.`);
      }
    }); // don't pass abortController.signal because getDependencies() is blocking
  });
}

export { tapStartToRunWorkers };
