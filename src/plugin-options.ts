import type { FormatterOptions } from './formatter';
import type { IssueOptions } from './issue/issue-options';
import type LoggerOptions from './logger/logger-options';
import type { TypeScriptWorkerOptions } from './typescript/type-script-worker-options';

interface ForkTsCheckerWebpackPluginOptions {
  async?: boolean;
  typescript?: TypeScriptWorkerOptions;
  formatter?: FormatterOptions;
  issue?: IssueOptions;
  logger?: LoggerOptions;
}

export { ForkTsCheckerWebpackPluginOptions };
