import type { FilesChange } from 'src/files-change';
import { updateFilesChange } from 'src/files-change';
import { tapStartToRunWorkers } from 'src/hooks/tap-start-to-run-workers';
import type { ForkTsCheckerWebpackPluginConfig } from 'src/plugin-config';
import { createPluginState } from 'src/plugin-state';
import type { RpcWorker } from 'src/rpc';
import type { GetDependenciesWorker } from 'src/typescript/worker/get-dependencies-worker';
import type { GetIssuesWorker } from 'src/typescript/worker/get-issues-worker';
import { SyncHook } from 'tapable';
import type * as webpack from 'webpack';

function createCompiler(): webpack.Compiler {
  const logger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  };

  return {
    hooks: {
      run: new SyncHook<[unknown]>(['compiler']),
      watchRun: new SyncHook<[unknown]>(['compiler']),
      compilation: new SyncHook<[unknown, unknown]>(['compilation', 'params']),
    },
    getInfrastructureLogger: () => logger,
  } as unknown as webpack.Compiler;
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('tap-start-to-run-workers', () => {
  it('passes changed files of an aborted iteration to the next iteration', async () => {
    const compiler = createCompiler();
    const compilation = { compiler } as unknown as webpack.Compilation;
    const state = createPluginState();
    state.watching = true;

    let finishFirstCheck: () => void = () => undefined;
    const firstCheck = new Promise<void>((resolve) => {
      finishFirstCheck = resolve;
    });
    const getIssuesWorker = jest.fn(async () => {
      if (getIssuesWorker.mock.calls.length === 1) {
        await firstCheck;
      }
      return [];
    });
    const getDependenciesWorker = jest.fn(async () => ({
      files: [],
      dirs: [],
      excluded: [],
      extensions: [],
    }));

    tapStartToRunWorkers(
      compiler,
      getIssuesWorker as unknown as RpcWorker<GetIssuesWorker>,
      getDependenciesWorker as unknown as RpcWorker<GetDependenciesWorker>,
      {} as ForkTsCheckerWebpackPluginConfig,
      state
    );

    const compile = async (changedFiles: string[]) => {
      updateFilesChange(compiler, { changedFiles });
      compiler.hooks.compilation.call(compilation, {} as never);
      await flushPromises();
    };

    await compile(['a.ts']); // iteration 1 - starts the check, which is still running
    await compile(['b.ts']); // iteration 2 - waits for iteration 1
    await compile(['a.ts']); // iteration 3 - aborts iteration 2 before it runs

    finishFirstCheck();
    await state.issuesPromise;

    // iteration 1 and iteration 3 run, iteration 2 is skipped
    expect(getIssuesWorker).toHaveBeenCalledTimes(2);
    const lastChange = (getIssuesWorker.mock.calls[1] as unknown as [FilesChange])[0];
    expect([...(lastChange.changedFiles || [])].sort()).toEqual(['a.ts', 'b.ts']);
  });
});
