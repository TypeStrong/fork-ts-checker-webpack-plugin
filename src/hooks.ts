import * as webpack from 'webpack';
import { AsyncSeriesHook, SyncHook } from 'tapable';

const compilerHookMap = new WeakMap();

export const customHooks = {
  forkTsCheckerServiceBeforeStart: 'fork-ts-checker-service-before-start',
  forkTsCheckerCancel: 'fork-ts-checker-cancel',
  forkTsCheckerServiceStartError: 'fork-ts-checker-service-start-error',
  forkTsCheckerWaiting: 'fork-ts-checker-waiting',
  forkTsCheckerServiceStart: 'fork-ts-checker-service-start',
  forkTsCheckerReceive: 'fork-ts-checker-receive',
  forkTsCheckerServiceOutOfMemory: 'fork-ts-checker-service-out-of-memory',
  forkTsCheckerEmit: 'fork-ts-checker-emit',
  forkTsCheckerDone: 'fork-ts-checker-done'
};

function createForkTsCheckerWebpackPluginHooks(): Record<
  keyof typeof customHooks,
  SyncHook | AsyncSeriesHook
> {
  return {
    forkTsCheckerServiceBeforeStart: new AsyncSeriesHook([]),
    forkTsCheckerCancel: new SyncHook(['cancellationToken']),
    forkTsCheckerServiceStartError: new SyncHook(['error']),
    forkTsCheckerWaiting: new SyncHook(['hasTsLint']),
    forkTsCheckerServiceStart: new SyncHook([
      'tsconfigPath',
      'tslintPath',
      'watchPaths',
      'workersNumber',
      'memoryLimit'
    ]),
    forkTsCheckerReceive: new SyncHook(['diagnostics', 'lints']),
    forkTsCheckerServiceOutOfMemory: new SyncHook([]),
    forkTsCheckerEmit: new SyncHook(['diagnostics', 'lints', 'elapsed']),
    forkTsCheckerDone: new SyncHook(['diagnostics', 'lints', 'elapsed'])
  };
}

export function getForkTsCheckerWebpackPluginHooks(compiler: webpack.Compiler) {
  let hooks: Record<
    keyof typeof customHooks,
    SyncHook | AsyncSeriesHook
  > = compilerHookMap.get(compiler);
  if (hooks === undefined) {
    hooks = createForkTsCheckerWebpackPluginHooks();
    compilerHookMap.set(compiler, hooks);
  }
  return hooks;
}
