import type webpack from 'webpack';

import type { FormatterConfig } from './formatter';
import { createFormatterConfig } from './formatter';
import type { IssueConfig } from './issue/issue-config';
import { createIssueConfig } from './issue/issue-config';
import type { LoggerConfig } from './logger/logger-config';
import { createLoggerConfig } from './logger/logger-config';
import type { ForkTsCheckerWebpackPluginOptions } from './plugin-options';
import type { TypeScriptWorkerConfig } from './typescript/type-script-worker-config';
import { createTypeScriptWorkerConfig } from './typescript/type-script-worker-config';

interface ForkTsCheckerWebpackPluginConfig {
  async: boolean;
  typescript: TypeScriptWorkerConfig;
  issue: IssueConfig;
  formatter: FormatterConfig;
  logger: LoggerConfig;
}

function createPluginConfig(
  compiler: webpack.Compiler,
  options: ForkTsCheckerWebpackPluginOptions = {}
): ForkTsCheckerWebpackPluginConfig {
  return {
    async: options.async === undefined ? compiler.options.mode === 'development' : options.async,
    typescript: createTypeScriptWorkerConfig(compiler, options.typescript),
    issue: createIssueConfig(compiler, options.issue),
    formatter: createFormatterConfig(options.formatter),
    logger: createLoggerConfig(compiler, options.logger),
  };
}

export { ForkTsCheckerWebpackPluginConfig, createPluginConfig };
