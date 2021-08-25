import webpack from 'webpack';
import { validate } from 'schema-utils';
// type only dependency
// eslint-disable-next-line node/no-extraneous-import
import type { JSONSchema7 } from 'json-schema';
import { cosmiconfigSync } from 'cosmiconfig';
import merge from 'deepmerge';
import schema from './ForkTsCheckerWebpackPluginOptions.json';
import { ForkTsCheckerWebpackPluginOptions } from './ForkTsCheckerWebpackPluginOptions';
import { createForkTsCheckerWebpackPluginConfiguration } from './ForkTsCheckerWebpackPluginConfiguration';
import { createForkTsCheckerWebpackPluginState } from './ForkTsCheckerWebpackPluginState';
import { assertTypeScriptSupport } from './typescript-reporter/TypeScriptSupport';
import { createTypeScriptReporterRpcClient } from './typescript-reporter/reporter/TypeScriptReporterRpcClient';
import { tapStartToConnectAndRunReporter } from './hooks/tapStartToConnectAndRunReporter';
import { tapStopToDisconnectReporter } from './hooks/tapStopToDisconnectReporter';
import { tapAfterCompileToAddDependencies } from './hooks/tapAfterCompileToAddDependencies';
import { tapErrorToLogMessage } from './hooks/tapErrorToLogMessage';
import { getForkTsCheckerWebpackPluginHooks } from './hooks/pluginHooks';
import { tapAfterEnvironmentToPatchWatching } from './hooks/tapAfterEnvironmentToPatchWatching';
import { createPool, Pool } from './utils/async/pool';
import os from 'os';

class ForkTsCheckerWebpackPlugin {
  /**
   * Current version of the plugin
   */
  static readonly version: string = '{{VERSION}}'; // will be replaced by the @semantic-release/exec
  /**
   * Default pools for the plugin concurrency limit
   */
  static readonly issuesPool: Pool = createPool(Math.max(1, os.cpus().length));
  static readonly dependenciesPool: Pool = createPool(Math.max(1, os.cpus().length));

  /**
   * @deprecated Use ForkTsCheckerWebpackPlugin.issuesPool instead
   */
  static get pool(): Pool {
    // for backward compatibility
    return ForkTsCheckerWebpackPlugin.issuesPool;
  }

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
    const issuesReporter = createTypeScriptReporterRpcClient(configuration.typescript);
    const dependenciesReporter = createTypeScriptReporterRpcClient(configuration.typescript);

    tapAfterEnvironmentToPatchWatching(compiler, state);
    tapStartToConnectAndRunReporter(
      compiler,
      issuesReporter,
      dependenciesReporter,
      configuration,
      state
    );
    tapAfterCompileToAddDependencies(compiler, configuration, state);
    tapStopToDisconnectReporter(compiler, issuesReporter, dependenciesReporter, state);
    tapErrorToLogMessage(compiler, configuration);
  }
}

export { ForkTsCheckerWebpackPlugin };
