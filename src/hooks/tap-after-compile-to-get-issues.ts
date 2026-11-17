import type * as webpack from 'webpack';

import { getInfrastructureLogger } from '../infrastructure-logger';
import type { Issue } from '../issue';
import type { ForkTsCheckerWebpackPluginConfig } from '../plugin-config';
import { getPluginHooks } from '../plugin-hooks';
import type { ForkTsCheckerWebpackPluginState } from '../plugin-state';

import { addIssuesToCompilation, getIssuesToReport } from './report-issues';

function tapAfterCompileToGetIssues(
  compiler: webpack.Compiler,
  config: ForkTsCheckerWebpackPluginConfig,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getPluginHooks(compiler);
  const { debug } = getInfrastructureLogger(compiler);

  compiler.hooks.afterCompile.tapPromise('ForkTsCheckerWebpackPlugin', async (compilation) => {
    if (compilation.compiler !== compiler) {
      // run only for the compiler that the plugin was registered for
      return;
    }

    let issues: Issue[] | undefined = [];

    try {
      issues = await state.issuesPromise;
    } catch (error) {
      hooks.error.call(error, compilation);
      return;
    }

    debug('Got issues from the issues check.', issues?.length);

    if (!issues) {
      // some error has been thrown or it was canceled
      return;
    }

    addIssuesToCompilation(getIssuesToReport(issues, compilation, config), compilation, config);
  });
}

export { tapAfterCompileToGetIssues };
