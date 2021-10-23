import type * as webpack from 'webpack';

import type { FormatterConfig, FormatterOptions } from './formatter/formatter-config';
import { createFormatterConfig } from './formatter/formatter-config';
import type { IssueConfig, IssueOptions } from './issue/issue-config';
import { createIssueConfig } from './issue/issue-config';
import { createTypeScriptConfig } from './typescript/typescript-config';
import type { TypeScriptConfig, TypeScriptOptions } from './typescript/typescript-config';

interface Logger {
  // eslint-disable-next-line
  log: (message: any) => void;
  // eslint-disable-next-line
  error: (message: any) => void;
}

interface ForkTsCheckerWebpackPluginOptions {
  async?: boolean;
  typescript?: TypeScriptOptions;
  formatter?: FormatterOptions;
  issue?: IssueOptions;
  logger?: Logger;
}
interface ForkTsCheckerWebpackPluginConfig {
  async: boolean;
  typescript: TypeScriptConfig;
  formatter: FormatterConfig;
  issue: IssueConfig;
  logger: Logger;
}

function createPluginConfig(
  compiler: webpack.Compiler,
  options: ForkTsCheckerWebpackPluginOptions = {}
): ForkTsCheckerWebpackPluginConfig {
  return {
    async: options.async === undefined ? compiler.options.mode === 'development' : options.async,
    typescript: createTypeScriptConfig(compiler, options.typescript),
    issue: createIssueConfig(compiler, options.issue),
    formatter: createFormatterConfig(options.formatter),
    logger: options.logger || console,
  };
}

export {
  Logger,
  ForkTsCheckerWebpackPluginOptions,
  ForkTsCheckerWebpackPluginConfig,
  createPluginConfig,
};
