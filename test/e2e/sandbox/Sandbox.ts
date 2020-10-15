import { join, resolve, dirname } from 'path';
import fs from 'fs-extra';
import os from 'os';
import { exec, ChildProcess } from 'child_process';
import spawn from 'cross-spawn';
import { Fixture } from './Fixture';
import stripAnsi from 'strip-ansi';
import treeKill from 'tree-kill';
import flatten from '../../../src/utils/array/flatten';

interface Sandbox {
  context: string;
  load: (
    fixtures: Fixture | Fixture[],
    installer?: (sandbox: Sandbox) => Promise<unknown>
  ) => Promise<void>;
  reset: () => Promise<void>;
  cleanup: () => Promise<void>;
  write: (path: string, content: string) => Promise<void>;
  read: (path: string) => Promise<string>;
  exists: (path: string) => Promise<boolean>;
  remove: (path: string) => Promise<void>;
  patch: (path: string, search: string, replacement: string) => Promise<void>;
  exec: (command: string, env?: Record<string, string>) => Promise<string>;
  spawn: (command: string, env?: Record<string, string>) => ChildProcess;
  kill: (childProcess: ChildProcess) => Promise<void>;
}

function wait(timeout = 250) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * The IO effects sometimes fail due to different external issues - for example, network or filesystem.
 * To make these tests more reliable, we can wrap these effects in the `retry` function.
 *
 * @param effect
 * @param retries
 * @param delay
 */
async function retry<T>(effect: () => Promise<T>, retries = 3, delay = 250): Promise<T> {
  let lastError: unknown;

  for (let retry = 1; retry <= retries; ++retry) {
    try {
      return await effect();
    } catch (error) {
      console.log(`${error.toString()}.\nRetry ${retry} of ${retries}.`);
      lastError = error;
      await wait(delay);
    }
  }

  throw lastError;
}

// create cache directory to speed-up the testing
const CACHE_DIR = fs.mkdtempSync(join(os.tmpdir(), 'fork-ts-checker-cache-'));
const NPM_CACHE_DIR = join(CACHE_DIR, 'npm');
const YARN_CACHE_DIR = join(CACHE_DIR, 'yarn');

async function npmInstaller(sandbox: Sandbox) {
  await retry(() =>
    sandbox.exec('npm install', {
      // eslint-disable-next-line @typescript-eslint/camelcase
      npm_config_cache: NPM_CACHE_DIR,
    })
  );
}

async function yarnInstaller(sandbox: Sandbox) {
  await retry(() =>
    sandbox.exec('yarn install', {
      YARN_CACHE_FOLDER: YARN_CACHE_DIR,
    })
  );
}

async function createSandbox(): Promise<Sandbox> {
  const context = fs.realpathSync.native(
    await fs.mkdtemp(join(os.tmpdir(), 'fork-ts-checker-sandbox-'))
  );

  let createdFiles: string[] = [];
  let childProcesses: ChildProcess[] = [];

  async function removeCreatedFiles() {
    await Promise.all(createdFiles.map((path) => sandbox.remove(path)));
    createdFiles = [];

    await wait();
  }

  async function killSpawnedProcesses() {
    for (const childProcess of childProcesses) {
      await sandbox.kill(childProcess);
    }

    await wait();
  }

  function normalizeEol(content: string): string {
    return content.split(/\r\n?|\n/).join('\n');
  }

  process.stdout.write(`Sandbox directory: ${context}\n`);

  const sandbox: Sandbox = {
    context,
    load: async (fixture, installer = npmInstaller) => {
      const fixtures = Array.isArray(fixture) ? fixture : [fixture];

      // write files
      await Promise.all(
        flatten(
          fixtures.map((fixture) =>
            Object.keys(fixture).map((path) => sandbox.write(path, fixture[path]))
          )
        )
      );
      process.stdout.write('Fixtures initialized.\n');

      process.stdout.write('Installing dependencies...\n');
      await installer(sandbox);
      process.stdout.write('The sandbox initialized successfully.\n');

      createdFiles = [];

      await wait();
    },
    reset: async () => {
      process.stdout.write('Resetting the sandbox...\n');

      await killSpawnedProcesses();
      await removeCreatedFiles();

      process.stdout.write(`Sandbox resetted.\n\n`);
    },
    cleanup: async () => {
      process.stdout.write('Cleaning up the sandbox...\n');

      await killSpawnedProcesses();

      process.stdout.write(`Removing sandbox directory: ${context}\n`);
      await fs.remove(context);

      process.stdout.write('Sandbox cleaned up.\n\n');
    },
    write: async (path: string, content: string) => {
      process.stdout.write(`Writing file ${path}...\n`);
      const realPath = join(context, path);
      const dirPath = dirname(realPath);

      if (!createdFiles.includes(path) && !(await fs.pathExists(realPath))) {
        createdFiles.push(path);
      }

      await retry(async () => {
        if (!(await fs.pathExists(dirPath))) {
          await fs.mkdirp(dirPath);
        }
      });

      // wait to avoid race conditions
      await wait();

      return retry(() => fs.writeFile(realPath, normalizeEol(content)));
    },
    read: (path: string) => {
      process.stdout.write(`Reading file ${path}...\n`);
      const realPath = join(context, path);

      return retry(() => fs.readFile(realPath, 'utf-8').then(normalizeEol));
    },
    exists: (path: string) => {
      const realPath = join(context, path);

      return fs.pathExists(realPath);
    },
    remove: async (path: string) => {
      process.stdout.write(`Removing file ${path}...\n`);
      const realPath = join(context, path);

      // wait for fs events to be propagated
      await wait();

      return retry(() => fs.remove(realPath));
    },
    patch: async (path: string, search: string, replacement: string) => {
      process.stdout.write(
        `Patching file ${path} - replacing "${search}" with "${replacement}"...\n`
      );
      const realPath = join(context, path);
      const content = await retry(() => fs.readFile(realPath, 'utf-8').then(normalizeEol));

      if (!content.includes(search)) {
        throw new Error(`Cannot find "${search}" in the ${path}. The file content:\n${content}.`);
      }

      // wait for fs events to be propagated
      await wait();

      return retry(() => fs.writeFile(realPath, content.replace(search, replacement)));
    },
    exec: (command: string, env = {}) =>
      new Promise<string>((resolve, reject) => {
        process.stdout.write(`Executing "${command}" command...\n`);

        const childProcess = exec(
          command,
          {
            cwd: context,
            env: {
              ...process.env,
              ...env,
            },
          },
          (error, stdout, stderr) => {
            if (error) {
              reject(stdout + stderr);
            } else {
              resolve(stdout + stderr);
            }
            childProcesses = childProcesses.filter(
              (aChildProcess) => aChildProcess !== childProcess
            );
          }
        );

        childProcess.stdout.on('data', (data) => process.stdout.write(stripAnsi(data.toString())));
        childProcess.stderr.on('data', (data) => process.stdout.write(stripAnsi(data.toString())));

        childProcesses.push(childProcess);
      }),
    spawn: (command: string, env = {}) => {
      process.stdout.write(`Spawning "${command}" command...\n`);

      const [spawnCommand, ...args] = command.split(' ');

      const childProcess = spawn(spawnCommand, args, {
        cwd: context,
        env: {
          ...process.env,
          ...env,
        },
      });

      childProcess.stdout.on('data', (data) => process.stdout.write(stripAnsi(data.toString())));
      childProcess.stderr.on('data', (data) => process.stdout.write(stripAnsi(data.toString())));
      childProcess.on('exit', () => {
        childProcesses = childProcesses.filter((aChildProcess) => aChildProcess !== childProcess);
      });

      childProcesses.push(childProcess);

      return childProcess;
    },
    kill: async (childProcess: ChildProcess) => {
      if (!childProcess.killed && childProcess.pid) {
        process.stdout.write(`Killing child process ${childProcess.pid}...\n`);
        await retry(
          () =>
            new Promise((resolve) =>
              treeKill(childProcess.pid, 'SIGKILL', (error) => {
                if (error) {
                  // we don't want to reject as it's probably some OS issue
                  // or already killed process
                  console.error(error);
                }
                resolve();
              })
            )
        );
        process.stdout.write(`Child process ${childProcess.pid} killed.\n`);
      }
      childProcesses = childProcesses.filter((aChildProcess) => aChildProcess !== childProcess);
    },
  };

  return sandbox;
}

const FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION = join(
  resolve(__dirname, '../../..'),
  'fork-ts-checker-webpack-plugin-0.0.0-semantic-release.tgz'
);

if (!fs.pathExistsSync(FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION)) {
  throw new Error(
    `Cannot find ${FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION} file. To run e2e test, execute "npm pack" command before.`
  );
}

export {
  Sandbox,
  createSandbox,
  npmInstaller,
  yarnInstaller,
  NPM_CACHE_DIR,
  YARN_CACHE_DIR,
  FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION,
};
