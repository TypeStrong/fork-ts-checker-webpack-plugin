import { ChildProcess } from 'child_process';
import stripAnsi from 'strip-ansi';
import { extractWebpackErrors } from './WebpackErrorsExtractor';
import { Listener } from './Listener';

interface WebpackDevServerDriver {
  waitForErrors: (timeout?: number) => Promise<string[]>;
  waitForNoErrors: (timeout?: number) => Promise<void>;
  close: () => Promise<boolean>;
}

interface ActivatableListener<T = void> extends Listener<T> {
  active: boolean;
}

function createWebpackDevServerDriver(
  process: ChildProcess,
  async: boolean,
  defaultTimeout = 30000
): WebpackDevServerDriver {
  let errorsListener: ActivatableListener<string[]> | undefined = undefined;
  let noErrorsListener: ActivatableListener | undefined = undefined;
  let errors: string[] = [];

  function nextIteration() {
    noErrorsListener = undefined;
    errorsListener = undefined;
    errors = [];
  }

  function activateListeners() {
    if (noErrorsListener) {
      noErrorsListener.active = true;
    }
    if (errorsListener) {
      errorsListener.active = true;
    }
  }

  if (process.stdout) {
    process.stdout.on('data', (data) => {
      const content = stripAnsi(data.toString());

      if (
        async &&
        content.includes('No issues found.') &&
        noErrorsListener &&
        noErrorsListener.active
      ) {
        noErrorsListener.resolve();
      }

      if (content.includes('Compiled successfully.')) {
        if (!async && noErrorsListener) {
          noErrorsListener.resolve();
        } else if (async) {
          activateListeners();
        }
      }

      if (content.includes('Failed to compile.') || content.includes('Compiled with warnings.')) {
        if (!async && errorsListener) {
          errorsListener.resolve(errors);
        } else if (async) {
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

      if (async && errors.length && errorsListener && errorsListener.active) {
        errorsListener.resolve(errors);
      }
    });
  }

  return {
    waitForErrors: (timeout = defaultTimeout) =>
      new Promise<string[]>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Exceeded time on waiting for errors to appear.'));
          nextIteration();
        }, timeout);

        errorsListener = {
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
        };
      }),
    waitForNoErrors: (timeout = defaultTimeout) =>
      new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Exceeded time on waiting for no errors message to appear.'));
          nextIteration();
        }, timeout);

        noErrorsListener = {
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
        };
      }),
    close: async () => process.kill(),
  };
}

// supported versions
const WEBPACK_CLI_VERSION = '^3.3.11';
const WEBPACK_DEV_SERVER_VERSION = '^3.10.3';

export { createWebpackDevServerDriver, WEBPACK_CLI_VERSION, WEBPACK_DEV_SERVER_VERSION };
