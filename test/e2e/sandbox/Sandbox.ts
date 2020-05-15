import { join, resolve, dirname } from 'path';
import fs from 'fs-extra';
import os from 'os';
import chalk from 'chalk';
import { exec, ChildProcess } from 'child_process';
import spawn from 'cross-spawn';
import { Fixture } from './Fixture';
import stripAnsi from 'strip-ansi';

interface Sandbox {
  context: string;
  children: ChildProcess[];
  load: (fixture: Fixture) => Promise<void>;
  reset: () => Promise<void>;
  cleanup: () => Promise<void>;
  write: (path: string, content: string) => Promise<void>;
  read: (path: string) => Promise<string>;
  exists: (path: string) => Promise<boolean>;
  remove: (path: string) => Promise<void>;
  patch: (path: string, search: string, replacement: string) => Promise<void>;
  exec: (command: string, env?: Record<string, string>) => Promise<string>;
  spawn: (command: string, env?: Record<string, string>) => ChildProcess;
}

function wait(timeout = 250) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

async function createSandbox(): Promise<Sandbox> {
  const context = await fs.mkdtemp(join(os.tmpdir(), 'fork-ts-checker-sandbox-'));
  let written: string[] = [];

  process.stdout.write(`Sandbox directory: ${context}\n`);

  const sandbox: Sandbox = {
    context,
    children: [],
    load: async (fixture) => {
      await Promise.all(Object.keys(fixture).map((path) => sandbox.write(path, fixture[path])));
      process.stdout.write(chalk.green('Fixture initialized.\n'));

      process.stdout.write(chalk.blue('Installing dependencies...\n'));
      // use custom directory to not use cached version of the plugin
      const YARN_CACHE_FOLDER = join(sandbox.context, '.yarn');
      // use --ignore-optional to speedup the installation and to omit `fsevents` as
      // webpack 4 uses old version which sometimes behave non-deterministic
      await sandbox.exec('yarn install --ignore-optional', {
        YARN_CACHE_FOLDER,
      });
      process.stdout.write(chalk.green('The sandbox initialized successfully.\n'));

      written = [];
    },
    reset: async () => {
      process.stdout.write('Resetting the sandbox\n');

      for (const child of sandbox.children) {
        if (!child.killed) {
          process.stdout.write(`Killing child process ${child.pid}\n`);
          child.kill('SIGKILL');
        }
      }

      // wait for processes to be killed
      await wait();

      process.stdout.write(`Resetting sandbox directory: ${context}\n`);
      await Promise.all(written.map((path) => sandbox.remove(path)));
      written = [];

      process.stdout.write(`Sandbox resetted\n\n`);
    },
    cleanup: async () => {
      process.stdout.write('Cleaning up the sandbox\n');

      for (const child of sandbox.children) {
        if (!child.killed) {
          process.stdout.write(`Killing child process ${child.pid}\n`);
          child.kill('SIGKILL');
        }
      }

      // wait for processes to be killed
      await wait();

      process.stdout.write(`Removing sandbox directory: ${context}\n`);
      await fs.remove(context);

      process.stdout.write('Sandbox cleaned up.\n\n');
    },
    write: async (path: string, content: string) => {
      process.stdout.write(`Writing file ${path}...\n`);
      const realPath = join(context, path);
      const dirPath = dirname(realPath);

      if (!written.includes(path) && !(await fs.pathExists(realPath))) {
        written.push(path);
      }

      if (!(await fs.pathExists(dirPath))) {
        await fs.mkdirp(dirPath);
      }

      // wait to avoid race conditions
      await new Promise((resolve) => setTimeout(resolve, 100));

      return fs.writeFile(realPath, content);
    },
    read: (path: string) => {
      process.stdout.write(`Reading file ${path}...\n`);
      const realPath = join(context, path);

      return fs.readFile(realPath, 'utf-8');
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

      return fs.remove(realPath);
    },
    patch: async (path: string, search: string, replacement: string) => {
      process.stdout.write(
        `Patching file ${path} - replacing "${search}" with "${replacement}"...\n`
      );
      const realPath = join(context, path);
      const content = await fs.readFile(realPath, 'utf-8');

      if (!content.includes(search)) {
        throw new Error(`Cannot find "${search}" in the ${path}. The file content:\n${content}.`);
      }

      // wait for fs events to be propagated
      await wait();

      return fs.writeFile(realPath, content.replace(search, replacement));
    },
    exec: (command: string, env = {}) =>
      new Promise<string>((resolve, reject) => {
        process.stdout.write(`Executing "${command}" command...\n`);

        const child = exec(
          command,
          {
            cwd: context,
            env: {
              ...process.env,
              ...env,
            },
          },
          (error, output) => {
            if (error) {
              reject(error);
            } else {
              resolve(output);
            }
          }
        );

        child.stdout.on('data', (data) => process.stdout.write(stripAnsi(data.toString())));
        child.stderr.on('data', (data) => process.stdout.write(stripAnsi(data.toString())));

        sandbox.children.push(child);
      }),
    spawn: (command: string, env = {}) => {
      process.stdout.write(`Spawning "${command}" command...\n`);

      const [spawnCommand, ...args] = command.split(' ');

      const child = spawn(spawnCommand, args, {
        cwd: context,
        env: {
          ...process.env,
          ...env,
        },
      });

      child.stdout.on('data', (data) => process.stdout.write(stripAnsi(data.toString())));
      child.stderr.on('data', (data) => process.stdout.write(stripAnsi(data.toString())));

      sandbox.children.push(child);

      return child;
    },
  };

  return sandbox;
}

const FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION = join(
  resolve(__dirname, '../../..'),
  'fork-ts-checker-webpack-plugin.tgz'
);

if (!fs.pathExistsSync(FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION)) {
  throw new Error(
    `Cannot find ${FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION} file. To run e2e test, execute "yarn pack --filename fork-ts-checker-webpack-plugin.tgz" command before.`
  );
}

export { Sandbox, createSandbox, FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION };
