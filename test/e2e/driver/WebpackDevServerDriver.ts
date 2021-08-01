import { ChildProcess } from 'child_process';
import stripAnsi from 'strip-ansi';
import { extractWebpackErrors } from './WebpackErrorsExtractor';
import { createQueuedListener, Listener, QueuedListener } from './Listener';

interface WebpackDevServerDriver {
  process: ChildProcess;
  waitForErrors: (timeout?: number) => Promise<string[]>;
  waitForNoErrors: (timeout?: number) => Promise<void>;
}

interface AsyncListener<T = void> extends Listener<T> {
  active: boolean;
}
interface QueuedAsyncListener<T = void> extends AsyncListener<T>, QueuedListener<T> {
  apply(listener: AsyncListener<T>): void;
}

function createQueuedAsyncListener<T = void>(active = false): QueuedAsyncListener<T> {
  const queuedListener = createQueuedListener<T>();
  const asyncListener: QueuedAsyncListener<T> = {
    ...queuedListener,
    apply(listener) {
      queuedListener.apply(listener);
      asyncListener.active = listener.active;
    },
    active,
  };

  return asyncListener;
}

function createWebpackDevServerDriver(
  process: ChildProcess,
  async: boolean,
  defaultTimeout = 30000
): WebpackDevServerDriver {
  let errorsListener = createQueuedAsyncListener<string[]>();
  let noErrorsListener = createQueuedAsyncListener<void>();
  let errors: string[] = [];

  function nextIteration() {
    errorsListener = createQueuedAsyncListener<string[]>();
    noErrorsListener = createQueuedAsyncListener<void>();
    errors = [];
  }

  function activateListeners() {
    noErrorsListener.active = true;
    errorsListener.active = true;
  }

  if (process.stdout) {
    process.stdout.on('data', (data) => {
      const content = stripAnsi(data.toString());

      if (async && content.includes('No issues found.')) {
        noErrorsListener.resolve();
      }

      if (content.includes('Compiled successfully.')) {
        if (!async) {
          noErrorsListener.resolve();
        } else {
          activateListeners();
        }
      }

      if (content.includes('Failed to compile.') || content.includes('Compiled with warnings.')) {
        if (!async) {
          errorsListener.resolve(errors);
        } else {
          activateListeners();
        }
      }
    });
  }

  if (process.stderr) {
    process.stderr.on('data', (data) => {
      const content = stripAnsi(data.toString());
      const extracted = extractWebpackErrors(content);
      errors.push(...extracted);

      if (async && extracted.length && errorsListener.active) {
        errorsListener.resolve(extracted);
      }
    });
  }

  return {
    process: process,
    waitForErrors: (timeout = defaultTimeout) =>
      new Promise<string[]>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Exceeded time on waiting for errors to appear.'));
          nextIteration();
        }, timeout);

        errorsListener.apply({
          resolve: (results) => {
            clearTimeout(timeoutId);
            nextIteration();
            resolve(results);
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            nextIteration();
            reject(error);
          },
          active: !async, // for async, we need to activate listener manually
        });
      }),
    waitForNoErrors: (timeout = defaultTimeout) =>
      new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Exceeded time on waiting for no errors message to appear.'));
          nextIteration();
        }, timeout);

        noErrorsListener.apply({
          resolve: () => {
            clearTimeout(timeoutId);
            nextIteration();
            resolve();
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            nextIteration();
            reject(error);
          },
          active: !async, // for async, we need to activate listener manually
        });
      }),
  };
}

export { WebpackDevServerDriver, createWebpackDevServerDriver };
