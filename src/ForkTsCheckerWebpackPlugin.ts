import * as path from 'path';

import { cosmiconfigSync } from 'cosmiconfig';
import merge from 'deepmerge';
import type { JSONSchema7 } from 'json-schema';
import { validate } from 'schema-utils';
import type webpack from 'webpack';
// type only dependency
// eslint-disable-next-line node/no-extraneous-import

import { createForkTsCheckerWebpackPluginConfiguration } from './ForkTsCheckerWebpackPluginConfiguration';
import type { ForkTsCheckerWebpackPluginOptions } from './ForkTsCheckerWebpackPluginOptions';
import schema from './ForkTsCheckerWebpackPluginOptions.json';
import { createForkTsCheckerWebpackPluginState } from './ForkTsCheckerWebpackPluginState';
import { getForkTsCheckerWebpackPluginHooks } from './hooks/pluginHooks';
import { dependenciesPool, issuesPool } from './hooks/pluginPools';
import { tapAfterCompileToAddDependencies } from './hooks/tapAfterCompileToAddDependencies';
import { tapAfterEnvironmentToPatchWatching } from './hooks/tapAfterEnvironmentToPatchWatching';
import { tapErrorToLogMessage } from './hooks/tapErrorToLogMessage';
import { tapStartToRunWorkers } from './hooks/tapStartToRunWorkers';
import { tapStopToTerminateWorkers } from './hooks/tapStopToTerminateWorkers';
import { assertTypeScriptSupport } from './typescript/TypeScriptSupport';
import type { GetDependenciesWorker } from './typescript/worker/get-dependencies-worker';
import type { GetIssuesWorker } from './typescript/worker/get-issues-worker';
import { createRpcWorker } from './utils/rpc';

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
    const configuration = { name: 'ForkTsCheckerWebpackPlugin' };
    validate(schema as JSONSchema7, options, configuration);

    this.options = merge(externalOptions || {}, options || {});

    // then validate merged options
    validate(schema as JSONSchema7, this.options, configuration);
  }

  public static getCompilerHooks(compiler: webpack.Compiler) {
    return getForkTsCheckerWebpackPluginHooks(compiler);
  }

  apply(compiler: webpack.Compiler) {
    const configuration = createForkTsCheckerWebpackPluginConfiguration(compiler, this.options);
    const state = createForkTsCheckerWebpackPluginState();

    assertTypeScriptSupport(configuration.typescript);
    const getIssuesWorker = createRpcWorker<GetIssuesWorker>(
      path.resolve(__dirname, './typescript/worker/get-issues-worker.js'),
      configuration.typescript,
      configuration.typescript.memoryLimit
    );
    const getDependenciesWorker = createRpcWorker<GetDependenciesWorker>(
      path.resolve(__dirname, './typescript/worker/get-dependencies-worker.js'),
      configuration.typescript
    );

    tapAfterEnvironmentToPatchWatching(compiler, state);
    tapStartToRunWorkers(compiler, getIssuesWorker, getDependenciesWorker, configuration, state);
    tapAfterCompileToAddDependencies(compiler, configuration, state);
    tapStopToTerminateWorkers(compiler, getIssuesWorker, getDependenciesWorker, state);
    tapErrorToLogMessage(compiler, configuration);
  }
}

export { ForkTsCheckerWebpackPlugin };
