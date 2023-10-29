import * as path from 'path';

import { cosmiconfigSync } from 'cosmiconfig';
import merge from 'deepmerge';
import type { JSONSchema7 } from 'json-schema';
import { validate } from 'schema-utils';
import type * as webpack from 'webpack';

import { tapAfterCompileToAddDependencies } from './hooks/tap-after-compile-to-add-dependencies';
import { tapAfterEnvironmentToPatchWatching } from './hooks/tap-after-environment-to-patch-watching';
import { tapErrorToLogMessage } from './hooks/tap-error-to-log-message';
import { tapStartToRunWorkers } from './hooks/tap-start-to-run-workers';
import { tapStopToTerminateWorkers } from './hooks/tap-stop-to-terminate-workers';
import { createPluginConfig } from './plugin-config';
import { getPluginHooks } from './plugin-hooks';
import type { ForkTsCheckerWebpackPluginOptions } from './plugin-options';
import schema from './plugin-options.json';
import { dependenciesPool, issuesPool } from './plugin-pools';
import { createPluginState } from './plugin-state';
import { createRpcWorker } from './rpc';
import { assertTypeScriptSupport } from './typescript/type-script-support';
import type { GetDependenciesWorker } from './typescript/worker/get-dependencies-worker';
import type { GetIssuesWorker } from './typescript/worker/get-issues-worker';

class ForkTsCheckerWebpackPlugin {
  /**
   * Current version of the plugin
   */
  static readonly version: string = '{{VERSION}}'; // will be replaced by the @semantic-release/exec
  /**
   * Default pools for the plugin concurrency limit
   */
  static readonly issuesPool = issuesPool;
  static readonly dependenciesPool = dependenciesPool;

  /**
   * @deprecated Use ForkTsCheckerWebpackPlugin.issuesPool instead
   */
  static readonly pool = issuesPool;

  private readonly options: ForkTsCheckerWebpackPluginOptions;

  constructor(options: ForkTsCheckerWebpackPluginOptions = {}) {
    const explorerSync = cosmiconfigSync('fork-ts-checker');
    const { config: externalOptions } = explorerSync.search() || {};

    // first validate options directly passed to the constructor
    const config = { name: 'ForkTsCheckerWebpackPlugin' };
    validate(schema as JSONSchema7, options, config);

    this.options = merge(externalOptions || {}, options || {});

    // then validate merged options
    validate(schema as JSONSchema7, this.options, config);
  }

  public static getCompilerHooks(compiler: webpack.Compiler) {
    return getPluginHooks(compiler);
  }

  apply(compiler: webpack.Compiler) {
    const config = createPluginConfig(compiler, this.options);
    const state = createPluginState();

    assertTypeScriptSupport(config.typescript);
    const getIssuesWorker = createRpcWorker<GetIssuesWorker>(
      path.resolve(__dirname, './typescript/worker/get-issues-worker.js'),
      config.typescript,
      config.typescript.memoryLimit
    );
    const getDependenciesWorker = createRpcWorker<GetDependenciesWorker>(
      path.resolve(__dirname, './typescript/worker/get-dependencies-worker.js'),
      config.typescript
    );

    tapAfterEnvironmentToPatchWatching(compiler, state);
    tapStartToRunWorkers(compiler, getIssuesWorker, getDependenciesWorker, config, state);
    tapAfterCompileToAddDependencies(compiler, config, state);
    tapStopToTerminateWorkers(compiler, getIssuesWorker, getDependenciesWorker, state);
    tapErrorToLogMessage(compiler, config);
  }
}

export { ForkTsCheckerWebpackPlugin };
