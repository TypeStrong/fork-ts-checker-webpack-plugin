import type { FormatterOptions } from './formatter';
import type { IssueOptions } from './issue/IssueOptions';
import type LoggerOptions from './logger/LoggerOptions';
import type { TypeScriptReporterOptions } from './typescript-reporter/TypeScriptReporterOptions';

interface ForkTsCheckerWebpackPluginOptions {
  async?: boolean;
  typescript?: TypeScriptReporterOptions;
  formatter?: FormatterOptions;
  issue?: IssueOptions;
  logger?: LoggerOptions;
}

export { ForkTsCheckerWebpackPluginOptions };
