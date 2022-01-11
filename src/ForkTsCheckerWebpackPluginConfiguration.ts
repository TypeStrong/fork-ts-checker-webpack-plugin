import type webpack from 'webpack';

import type { ForkTsCheckerWebpackPluginOptions } from './ForkTsCheckerWebpackPluginOptions';
import type { FormatterConfiguration } from './formatter';
import { createFormatterConfiguration } from './formatter';
import type { IssueConfiguration } from './issue/IssueConfiguration';
import { createIssueConfiguration } from './issue/IssueConfiguration';
import type { LoggerConfiguration } from './logger/LoggerConfiguration';
import { createLoggerConfiguration } from './logger/LoggerConfiguration';
import type { TypeScriptReporterConfiguration } from './typescript/TypeScriptReporterConfiguration';
import { createTypeScriptReporterConfiguration } from './typescript/TypeScriptReporterConfiguration';

interface ForkTsCheckerWebpackPluginConfiguration {
  async: boolean;
  typescript: TypeScriptReporterConfiguration;
  issue: IssueConfiguration;
  formatter: FormatterConfiguration;
  logger: LoggerConfiguration;
}

function createForkTsCheckerWebpackPluginConfiguration(
  compiler: webpack.Compiler,
  options: ForkTsCheckerWebpackPluginOptions = {}
): ForkTsCheckerWebpackPluginConfiguration {
  return {
    async: options.async === undefined ? compiler.options.mode === 'development' : options.async,
    typescript: createTypeScriptReporterConfiguration(compiler, options.typescript),
    issue: createIssueConfiguration(compiler, options.issue),
    formatter: createFormatterConfiguration(options.formatter),
    logger: createLoggerConfiguration(compiler, options.logger),
  };
}

export { ForkTsCheckerWebpackPluginConfiguration, createForkTsCheckerWebpackPluginConfiguration };
