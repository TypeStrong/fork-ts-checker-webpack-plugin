import { join, dirname } from 'path';
import fs from 'fs-extra';
import os from 'os';
import { exec, ChildProcess } from 'child_process';
import spawn from 'cross-spawn';
import { Fixture } from './Fixture';
import stripAnsi from 'strip-ansi';
import treeKill from 'tree-kill';
import flatten from '../../../src/utils/array/flatten';
import { logger } from './Logger';
import { readLockFileContent, writeLockFileContent } from './Lock';

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
  exec: (command: string, env?: Record<string, string>, cwd?: string) => Promise<string>;
  spawn: (command: string, env?: Record<string, string>, cwd?: string) => ChildProcess;
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
      logger.log(error.toString());
      logger.log(`Retry ${retry} of ${retries}.`);
      lastError = error;
      await wait(delay);
    }
  }

  throw lastError;
}

async function yarnInstaller(sandbox: Sandbox) {
  const lockFile = join(sandbox.context, 'yarn.lock');

  await readLockFileContent(lockFile);
  await retry(() => sandbox.exec('yarn install --prefer-offline'));
  await writeLockFileContent(lockFile);
}

async function createSandbox(): Promise<Sandbox> {
  const context = await fs.mkdtemp(join(os.tmpdir(), 'fork-ts-checker-sandbox-'));

  let createdFiles: string[] = [];
  let childProcesses: ChildProcess[] = [];

  async function removeCreatedFiles() {
    await Promise.all(createdFiles.map((path) => sandbox.remove(path)));
    createdFiles = [];
  }

  async function killSpawnedProcesses() {
    await Promise.all(childProcesses.map((childProcess) => sandbox.kill(childProcess)));
  }

  function normalizeEol(content: string): string {
    return content.split(/\r\n?|\n/).join('\n');
  }

  logger.log(`Sandbox directory: ${context}`);

  const sandbox: Sandbox = {
    context,
    load: async (fixture, installer = yarnInstaller) => {
      const fixtures = Array.isArray(fixture) ? fixture : [fixture];

      // write files
      await Promise.all(
        flatten(
          fixtures.map((fixture) =>
            Object.keys(fixture).map((path) => sandbox.write(path, fixture[path]))
          )
        )
      );
      logger.log('Fixtures initialized.');

      logger.log('Installing dependencies...');
      await installer(sandbox);
      logger.log('The sandbox initialized successfully.');

      createdFiles = [];
    },
    reset: async () => {
      logger.log('Resetting the sandbox...');

      await killSpawnedProcesses();
      await removeCreatedFiles();

      logger.log(`Sandbox reset.\n`);
    },
    cleanup: async () => {
      logger.log('Cleaning up the sandbox...');

      await killSpawnedProcesses();

      logger.log(`Removing sandbox directory: ${context}`);
      await fs.remove(context);

      logger.log('Sandbox cleaned up.\n');
    },
    write: async (path: string, content: string) => {
      logger.log(`Writing file ${path}...`);
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
      logger.log(`Reading file ${path}...`);
      const realPath = join(context, path);

      return retry(() => fs.readFile(realPath, 'utf-8').then(normalizeEol));
    },
    exists: (path: string) => {
      const realPath = join(context, path);

      return fs.pathExists(realPath);
    },
    remove: async (path: string) => {
      logger.log(`Removing file ${path}...`);
      const realPath = join(context, path);

      // wait for fs events to be propagated
      await wait();

      return retry(() => fs.remove(realPath));
    },
    patch: async (path: string, search: string, replacement: string) => {
      logger.log(`Patching file ${path} - replacing "${search}" with "${replacement}"...`);
      const realPath = join(context, path);
      const content = await retry(() => fs.readFile(realPath, 'utf-8').then(normalizeEol));

      if (!content.includes(search)) {
        throw new Error(`Cannot find "${search}" in the ${path}. The file content:\n${content}.`);
      }

      // wait for fs events to be propagated
      await wait();

      return retry(() => fs.writeFile(realPath, content.replace(search, replacement)));
    },
    exec: (command: string, env = {}, cwd = context) =>
      new Promise<string>((resolve, reject) => {
        logger.log(`Executing "${command}" command...`);

        const childProcess = exec(
          command,
          {
            cwd,
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
    spawn: (command: string, env = {}, cwd = context) => {
      logger.log(`Spawning "${command}" command...`);

      const [spawnCommand, ...args] = command.split(' ');

      const childProcess = spawn(spawnCommand, args, {
        cwd,
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
        logger.log(`Killing child process ${childProcess.pid}...`);
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
        logger.log(`Child process ${childProcess.pid} killed.`);
      }
      childProcesses = childProcesses.filter((aChildProcess) => aChildProcess !== childProcess);
    },
  };

  return sandbox;
}

export { Sandbox, createSandbox, yarnInstaller };
