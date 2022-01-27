import type { FormatterOptions } from './formatter';
import type { IssueOptions } from './issue/issue-options';
import type { Logger } from './logger';
import type { TypeScriptWorkerOptions } from './typescript/type-script-worker-options';

interface ForkTsCheckerWebpackPluginOptions {
  async?: boolean;
  typescript?: TypeScriptWorkerOptions;
  formatter?: FormatterOptions;
  issue?: IssueOptions;
  logger?: Logger;
  devServer?: boolean;
}

export { ForkTsCheckerWebpackPluginOptions };
