import { TypeScriptReporterOptions } from './typescript-reporter/TypeScriptReporterOptions';
import { IssueOptions } from './issue/IssueOptions';
import { FormatterOptions } from './formatter';
import LoggerOptions from './logger/LoggerOptions';

interface ForkTsCheckerWebpackPluginOptions {
  async?: boolean;
  typescript?: TypeScriptReporterOptions;
  formatter?: FormatterOptions;
  issue?: IssueOptions;
  logger?: LoggerOptions;
}

export { ForkTsCheckerWebpackPluginOptions };
