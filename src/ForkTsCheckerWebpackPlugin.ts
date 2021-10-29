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
import { tapStartToConnectAndRunReporter } from './hooks/tapStartToConnectAndRunReporter';
import { tapStopToDisconnectReporter } from './hooks/tapStopToDisconnectReporter';
import { createTypeScriptReporterRpcClient } from './typescript-reporter/reporter/TypeScriptReporterRpcClient';
import { assertTypeScriptSupport } from './typescript-reporter/TypeScriptSupport';

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
