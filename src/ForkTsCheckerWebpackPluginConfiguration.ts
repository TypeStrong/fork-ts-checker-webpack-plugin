import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginOptions } from './ForkTsCheckerWebpackPluginOptions';
import { createIssueConfiguration, IssueConfiguration } from './issue/IssueConfiguration';
import { createFormatterConfiguration, FormatterConfiguration } from './formatter';
import {
  createTypeScriptReporterConfiguration,
  TypeScriptReporterConfiguration,
} from './typescript-reporter/TypeScriptReporterConfiguration';
import {
  createEsLintReporterConfiguration,
  EsLintReporterConfiguration,
} from './eslint-reporter/EsLintReporterConfiguration';
import { createLoggerConfiguration, LoggerConfiguration } from './logger/LoggerConfiguration';

interface ForkTsCheckerWebpackPluginConfiguration {
  async: boolean;
  typescript: TypeScriptReporterConfiguration;
  eslint: EsLintReporterConfiguration;
  formatter: FormatterConfiguration;
  issue: IssueConfiguration;
  logger: LoggerConfiguration;
}

function createForkTsCheckerWebpackPluginConfiguration(
  compiler: webpack.Compiler,
  options: ForkTsCheckerWebpackPluginOptions = {}
): ForkTsCheckerWebpackPluginConfiguration {
  return {
    async: options.async === true,
    typescript: createTypeScriptReporterConfiguration(compiler, options.typescript),
    eslint: createEsLintReporterConfiguration(compiler, options.eslint),
    formatter: createFormatterConfiguration(options.formatter),
    issue: createIssueConfiguration(compiler, options.issue),
    logger: createLoggerConfiguration(compiler, options.logger),
  };
}

export { ForkTsCheckerWebpackPluginConfiguration, createForkTsCheckerWebpackPluginConfiguration };
