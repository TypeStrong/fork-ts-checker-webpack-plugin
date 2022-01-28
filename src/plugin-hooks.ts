import { SyncHook, SyncWaterfallHook, AsyncSeriesWaterfallHook } from 'tapable';
import type * as webpack from 'webpack';

import type { FilesChange } from './files-change';
import type { Issue } from './issue';

const compilerHookMap = new WeakMap<
  webpack.Compiler | webpack.MultiCompiler,
  ForkTsCheckerWebpackPluginHooks
>();

function createPluginHooks() {
  return {
    start: new AsyncSeriesWaterfallHook<[FilesChange, webpack.Compilation]>([
      'change',
      'compilation',
    ]),
    waiting: new SyncHook<[webpack.Compilation]>(['compilation']),
    canceled: new SyncHook<[webpack.Compilation]>(['compilation']),
    error: new SyncHook<[unknown, webpack.Compilation]>(['error', 'compilation']),
    issues: new SyncWaterfallHook<[Issue[], webpack.Compilation | undefined], void>([
      'issues',
      'compilation',
    ]),
  };
}

type ForkTsCheckerWebpackPluginHooks = ReturnType<typeof createPluginHooks>;

function forwardPluginHooks(
  source: ForkTsCheckerWebpackPluginHooks,
  target: ForkTsCheckerWebpackPluginHooks
) {
  source.start.tapPromise('ForkTsCheckerWebpackPlugin', target.start.promise);
  source.waiting.tap('ForkTsCheckerWebpackPlugin', target.waiting.call);
  source.canceled.tap('ForkTsCheckerWebpackPlugin', target.canceled.call);
  source.error.tap('ForkTsCheckerWebpackPlugin', target.error.call);
  source.issues.tap('ForkTsCheckerWebpackPlugin', target.issues.call);
}

function getPluginHooks(compiler: webpack.Compiler | webpack.MultiCompiler) {
  let hooks = compilerHookMap.get(compiler);
  if (hooks === undefined) {
    hooks = createPluginHooks();
    compilerHookMap.set(compiler, hooks);

    // proxy hooks for multi-compiler
    if ('compilers' in compiler) {
      compiler.compilers.forEach((childCompiler) => {
        const childHooks = getPluginHooks(childCompiler);

        if (hooks) {
          forwardPluginHooks(childHooks, hooks);
        }
      });
    }
  }
  return hooks;
}

export { getPluginHooks, ForkTsCheckerWebpackPluginHooks };
