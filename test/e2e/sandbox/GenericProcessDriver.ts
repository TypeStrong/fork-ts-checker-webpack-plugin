import { ChildProcess } from 'child_process';
import { Listener } from './Listener';
import stripAnsi from 'strip-ansi';

interface GenericProcessDriver {
  waitForStdoutIncludes: (string: string, timeout?: number) => Promise<void>;
  waitForStderrIncludes: (string: string, timeout?: number) => Promise<void>;
  close: () => Promise<boolean>;
}

interface StringListener extends Listener {
  string: string;
}

function createGenericProcessDriver(
  process: ChildProcess,
  defaultTimeout = 30000
): GenericProcessDriver {
  let stdoutListener: StringListener | undefined = undefined;
  let stderrListener: StringListener | undefined = undefined;

  if (process.stdout) {
    process.stdout.on('data', (data) => {
      const content = stripAnsi(data.toString());

      if (stdoutListener && content.includes(stdoutListener.string)) {
        stdoutListener.resolve();
      }
    });
  }

  if (process.stderr) {
    process.stderr.on('data', (data) => {
      const content = stripAnsi(data.toString());

      if (stderrListener && content.includes(stderrListener.string)) {
        stderrListener.resolve();
      }
    });
  }

  return {
    waitForStdoutIncludes: (string, timeout = defaultTimeout) =>
      new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Exceeded time on waiting for "${string}" to appear in the stdout.`));
        }, timeout);

        stdoutListener = {
          resolve: () => {
            clearTimeout(timeoutId);
            stdoutListener = undefined;
            resolve();
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            stdoutListener = undefined;
            reject(error);
          },
          string,
        };
      }),
    waitForStderrIncludes: (string, timeout = defaultTimeout) =>
      new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Exceeded time on waiting for "${string}" to appear in the stderr.`));
        }, timeout);

        stderrListener = {
          resolve: () => {
            clearTimeout(timeoutId);
            stderrListener = undefined;
            resolve();
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            stderrListener = undefined;
            reject(error);
          },
          string,
        };
      }),
    close: async () => process.kill(),
  };
}

export { createGenericProcessDriver };
