import webpack from 'webpack';
import validateOptions from 'schema-utils';
import schema from './ForkTsCheckerWebpackPluginOptions.json';
import { ForkTsCheckerWebpackPluginOptions } from './ForkTsCheckerWebpackPluginOptions';
import { createForkTsCheckerWebpackPluginConfiguration } from './ForkTsCheckerWebpackPluginConfiguration';
import { createForkTsCheckerWebpackPluginState } from './ForkTsCheckerWebpackPluginState';
import { composeReporterRpcClients, createAggregatedReporter, ReporterRpcClient } from './reporter';
import { assertTypeScriptSupport } from './typescript-reporter/assertTypeScriptSupport';
import { createTypeScriptReporterRpcClient } from './typescript-reporter/reporter/TypeScriptReporterRpcClient';
import { assertEsLintSupport } from './eslint-reporter/assertEsLintSupport';
import { createEsLintReporterRpcClient } from './eslint-reporter/reporter/EsLintReporterRpcClient';
import { tapDoneToAsyncGetIssues } from './hooks/tapDoneToAsyncGetIssues';
import { tapInvalidToUpdateState } from './hooks/tapInvalidToUpdateState';
import { tapStartToConnectAndRunReporter } from './hooks/tapStartToConnectAndRunReporter';
import { tapStopToDisconnectReporter } from './hooks/tapStopToDisconnectReporter';
import { tapAfterCompileToGetIssues } from './hooks/tapAfterCompileToGetIssues';
import { getForkTsCheckerWebpackPluginHooks } from './hooks/pluginHooks';

class ForkTsCheckerWebpackPlugin implements webpack.Plugin {
  constructor(private readonly options: ForkTsCheckerWebpackPluginOptions = {}) {
    validateOptions(schema, options, 'ForkTsCheckerWebpackPlugin');
  }

  public static getCompilerHooks(compiler: webpack.Compiler) {
    return getForkTsCheckerWebpackPluginHooks(compiler);
  }

  apply(compiler: webpack.Compiler) {
    const configuration = createForkTsCheckerWebpackPluginConfiguration(compiler, this.options);
    const state = createForkTsCheckerWebpackPluginState();
    const reporters: ReporterRpcClient[] = [];

    if (configuration.typescript.enabled) {
      assertTypeScriptSupport(configuration.typescript);
      reporters.push(createTypeScriptReporterRpcClient(configuration.typescript));
    }

    if (configuration.eslint.enabled) {
      assertEsLintSupport(configuration.eslint);
      reporters.push(createEsLintReporterRpcClient(configuration.eslint));
    }

    if (reporters.length) {
      const reporter = createAggregatedReporter(composeReporterRpcClients(reporters));

      tapInvalidToUpdateState(compiler, configuration, state);
      tapStartToConnectAndRunReporter(compiler, reporter, configuration, state);
      tapStopToDisconnectReporter(compiler, reporter, configuration, state);
      if (configuration.async) {
        tapDoneToAsyncGetIssues(compiler, configuration, state);
      } else {
        tapAfterCompileToGetIssues(compiler, configuration, state);
      }
    } else {
      configuration.logger.infrastructure.error(
        `ForkTsCheckerWebpackPlugin is configured to not use any issue reporter. It's probably a configuration issue.`
      );
    }
  }
}

export { ForkTsCheckerWebpackPlugin };
