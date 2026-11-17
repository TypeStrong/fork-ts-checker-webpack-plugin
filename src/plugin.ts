import { cosmiconfigSync } from 'cosmiconfig';
import type { JSONSchema7 } from 'json-schema';
import { validate } from 'schema-utils';
import type * as webpack from 'webpack';

import { tapAfterCompileToAddDependencies } from './hooks/tap-after-compile-to-add-dependencies';
import { tapAfterEnvironmentToPatchWatching } from './hooks/tap-after-environment-to-patch-watching';
import { tapErrorToLogMessage } from './hooks/tap-error-to-log-message';
import { tapStartToRunChecks } from './hooks/tap-start-to-run-checks';
import { tapStopToCloseService } from './hooks/tap-stop-to-close-service';
import { createPluginConfig } from './plugin-config';
import { getPluginHooks } from './plugin-hooks';
import type { ForkTsCheckerWebpackPluginOptions } from './plugin-options';
import schema from './plugin-options.json';
import { dependenciesPool, issuesPool } from './plugin-pools';
import { createPluginState } from './plugin-state';
import { createTypeScriptService } from './typescript/service/type-script-service';
import { assertTypeScriptSupport } from './typescript/type-script-support';
import { deepMerge } from './utils/deep-merge';

class ForkTsCheckerWebpackPlugin {
  /**
   * Current version of the plugin
   */
  static readonly version: string = '{{VERSION}}'; // will be replaced by the @semantic-release/exec
  /**
   * Default pools for the plugin concurrency limit
   */
  static readonly issuesPool = issuesPool;
  static readonly dependenciesPool = dependenciesPool;

  /**
   * @deprecated Use ForkTsCheckerWebpackPlugin.issuesPool instead
   */
  static readonly pool = issuesPool;

  private readonly options: ForkTsCheckerWebpackPluginOptions;

  constructor(options: ForkTsCheckerWebpackPluginOptions = {}) {
    const explorerSync = cosmiconfigSync('fork-ts-checker');
    const { config: loadedOptions } = explorerSync.search() || {};
    // a config file that is an ES module (`export default`) is loaded as its namespace
    const externalOptions =
      loadedOptions?.__esModule && 'default' in loadedOptions
        ? loadedOptions.default
        : loadedOptions;

    // first validate options directly passed to the constructor
    const config = { name: 'ForkTsCheckerWebpackPlugin' };
    validate(schema as JSONSchema7, options, config);

    this.options = deepMerge(externalOptions || {}, options || {});

    // then validate merged options
    validate(schema as JSONSchema7, this.options, config);
  }

  public static getCompilerHooks(compiler: webpack.Compiler) {
    return getPluginHooks(compiler);
  }

  apply(compiler: webpack.Compiler) {
    const config = createPluginConfig(compiler, this.options);
    const state = createPluginState();

    assertTypeScriptSupport(config.typescript);
    const typescriptService = createTypeScriptService(config.typescript);

    tapAfterEnvironmentToPatchWatching(compiler, state);
    tapStartToRunChecks(compiler, typescriptService, config, state);
    tapAfterCompileToAddDependencies(compiler, config, state);
    tapStopToCloseService(compiler, typescriptService, state);
    tapErrorToLogMessage(compiler, config);
  }
}

export { ForkTsCheckerWebpackPlugin };
