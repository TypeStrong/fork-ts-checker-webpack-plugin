import * as webpack from 'webpack';
import { SyncHook, SyncWaterfallHook } from 'tapable';
import { FilesChange } from '../reporter';
import { Issue } from '../issue';

const compilerHookMap = new WeakMap<
  webpack.Compiler | webpack.MultiCompiler,
  ForkTsCheckerWebpackPluginHooks
>();

function createForkTsCheckerWebpackPluginHooks() {
  return {
    run: new SyncHook<webpack.Compiler>(['compiler']),
    runWatch: new SyncWaterfallHook<FilesChange, webpack.Compiler>(['change', 'compiler']),
    waiting: new SyncHook<webpack.compilation.Compilation>(['compilation']),
    cancelled: new SyncHook<webpack.compilation.Compilation>(['compilation']),
    error: new SyncHook<Error, webpack.compilation.Compilation>(['error', 'compilation']),
    issues: new SyncWaterfallHook<Issue[], webpack.compilation.Compilation | undefined, void>([
      'issues',
      'compilation',
    ]),
  };
}

type ForkTsCheckerWebpackPluginHooks = ReturnType<typeof createForkTsCheckerWebpackPluginHooks>;

function forwardForkTsCheckerWebpackPluginHooks(
  source: ForkTsCheckerWebpackPluginHooks,
  target: ForkTsCheckerWebpackPluginHooks
) {
  source.run.tap('ForkTsCheckerWebpackPlugin', target.run.call);
  source.runWatch.tap('ForkTsCheckerWebpackPlugin', target.runWatch.call);
  source.waiting.tap('ForkTsCheckerWebpackPlugin', target.waiting.call);
  source.cancelled.tap('ForkTsCheckerWebpackPlugin', target.cancelled.call);
  source.issues.tap('ForkTsCheckerWebpackPlugin', target.issues.call);
}

function getForkTsCheckerWebpackPluginHooks(compiler: webpack.Compiler | webpack.MultiCompiler) {
  let hooks = compilerHookMap.get(compiler);
  if (hooks === undefined) {
    hooks = createForkTsCheckerWebpackPluginHooks();
    compilerHookMap.set(compiler, hooks);

    // proxy hooks for multi-compiler
    if ('compilers' in compiler) {
      compiler.compilers.forEach((childCompiler) => {
        const childHooks = getForkTsCheckerWebpackPluginHooks(childCompiler);

        if (hooks) {
          forwardForkTsCheckerWebpackPluginHooks(childHooks, hooks);
        }
      });
    }
  }
  return hooks;
}

export { getForkTsCheckerWebpackPluginHooks, ForkTsCheckerWebpackPluginHooks };
