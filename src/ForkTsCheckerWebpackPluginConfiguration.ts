import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginOptions } from './ForkTsCheckerWebpackPluginOptions';
import { createIssueConfiguration, IssueConfiguration } from './issue/IssueConfiguration';
import { createFormatterConfiguration, FormatterConfiguration } from './formatter';
import {
  createTypeScriptReporterConfiguration,
  TypeScriptReporterConfiguration,
} from './typescript-reporter/TypeScriptReporterConfiguration';
import { createLoggerConfiguration, LoggerConfiguration } from './logger/LoggerConfiguration';

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
