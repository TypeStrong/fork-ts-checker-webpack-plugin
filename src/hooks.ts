import * as webpack from 'webpack';
import { AsyncSeriesHook, SyncHook } from 'tapable';

export type ForkTsCheckerHooks =
  | 'serviceBeforeStart'
  | 'cancel'
  | 'serviceStartError'
  | 'waiting'
  | 'serviceStart'
  | 'receive'
  | 'serviceOutOfMemory'
  | 'emit'
  | 'done';
type ForkTsCheckerHookMap = Record<
  ForkTsCheckerHooks,
  SyncHook | AsyncSeriesHook
>;

const compilerHookMap = new WeakMap<webpack.Compiler, ForkTsCheckerHookMap>();

function createForkTsCheckerWebpackPluginHooks(): ForkTsCheckerHookMap {
  return {
    serviceBeforeStart: new AsyncSeriesHook([]),
    cancel: new SyncHook(['cancellationToken']),
    serviceStartError: new SyncHook(['error']),
    waiting: new SyncHook([]),
    serviceStart: new SyncHook(['tsconfigPath', 'memoryLimit']),
    receive: new SyncHook(['diagnostics', 'lints']),
    serviceOutOfMemory: new SyncHook([]),
    emit: new SyncHook(['diagnostics', 'lints', 'elapsed']),
    done: new SyncHook(['diagnostics', 'lints', 'elapsed'])
  };
}

export function getForkTsCheckerWebpackPluginHooks(compiler: webpack.Compiler) {
  let hooks = compilerHookMap.get(compiler);
  if (hooks === undefined) {
    hooks = createForkTsCheckerWebpackPluginHooks();
    compilerHookMap.set(compiler, hooks);
  }
  return hooks;
}
