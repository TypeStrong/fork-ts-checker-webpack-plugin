// tslint:disable-next-line:no-implicit-dependencies
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
type ForkTsCheckerLegacyHookMap = Record<ForkTsCheckerHooks, string>;

const compilerHookMap = new WeakMap<webpack.Compiler, ForkTsCheckerHookMap>();

export const legacyHookMap: ForkTsCheckerLegacyHookMap = {
  serviceBeforeStart: 'fork-ts-checker-service-before-start',
  cancel: 'fork-ts-checker-cancel',
  serviceStartError: 'fork-ts-checker-service-start-error',
  waiting: 'fork-ts-checker-waiting',
  serviceStart: 'fork-ts-checker-service-start',
  receive: 'fork-ts-checker-receive',
  serviceOutOfMemory: 'fork-ts-checker-service-out-of-memory',
  emit: 'fork-ts-checker-emit',
  done: 'fork-ts-checker-done'
};

function createForkTsCheckerWebpackPluginHooks(): ForkTsCheckerHookMap {
  return {
    serviceBeforeStart: new AsyncSeriesHook([]),
    cancel: new SyncHook(['cancellationToken']),
    serviceStartError: new SyncHook(['error']),
    waiting: new SyncHook(['hasTsLint']),
    serviceStart: new SyncHook(['tsconfigPath', 'tslintPath', 'memoryLimit']),
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
