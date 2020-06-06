import { ChildProcess } from 'child_process';
import { createQueuedListener, Listener, QueuedListener } from './Listener';
import stripAnsi from 'strip-ansi';

interface GenericProcessDriver {
  process: ChildProcess;
  waitForStdoutIncludes: (string: string, timeout?: number) => Promise<void>;
  waitForStderrIncludes: (string: string, timeout?: number) => Promise<void>;
}

interface StringListener extends Listener {
  ingest(input: string): void;
  string?: string;
}

interface QueuedStringListener extends StringListener, QueuedListener {
  apply(listener: Omit<StringListener, 'ingest'>): void;
}

function createQueuedStringListener(): QueuedStringListener {
  let buffer = '';

  const queuedListener = createQueuedListener();
  const stringListener: QueuedStringListener = {
    ...queuedListener,
    apply(listener) {
      queuedListener.apply(listener);
      stringListener.string = listener.string;

      if (buffer.includes(stringListener.string)) {
        stringListener.resolve();
      }
    },
    ingest(input) {
      if (stringListener.string === undefined) {
        buffer += input;
      } else if (input.includes(stringListener.string)) {
        stringListener.resolve();
      }
    },
    string: undefined,
  };

  return stringListener;
}

function createGenericProcessDriver(
  process: ChildProcess,
  defaultTimeout = 30000
): GenericProcessDriver {
  let stdoutListener = createQueuedStringListener();
  let stderrListener = createQueuedStringListener();

  if (process.stdout) {
    process.stdout.on('data', (data) => {
      const content = stripAnsi(data.toString());
      stdoutListener.ingest(content);
    });
  }

  if (process.stderr) {
    process.stderr.on('data', (data) => {
      const content = stripAnsi(data.toString());
      stderrListener.ingest(content);
    });
  }

  return {
    process,
    waitForStdoutIncludes: (string, timeout = defaultTimeout) =>
      new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Exceeded time on waiting for "${string}" to appear in the stdout.`));
        }, timeout);

        stdoutListener.apply({
          resolve: () => {
            clearTimeout(timeoutId);
            stdoutListener = createQueuedStringListener();
            resolve();
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            stdoutListener = createQueuedStringListener();
            reject(error);
          },
          string,
        });
      }),
    waitForStderrIncludes: (string, timeout = defaultTimeout) =>
      new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Exceeded time on waiting for "${string}" to appear in the stderr.`));
        }, timeout);

        stderrListener.apply({
          resolve: () => {
            clearTimeout(timeoutId);
            stderrListener = createQueuedStringListener();
            resolve();
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            stderrListener = createQueuedStringListener();
            reject(error);
          },
          string,
        });
      }),
  };
}

export { createGenericProcessDriver };
