import path from 'path';

import { createWebpackDevServerDriver } from './driver/webpack-dev-server-driver';

/**
 * The versions the tests install over the ones in the fixtures. The fixtures'
 * package.json files pin the same versions, so update both together.
 */
export const TYPESCRIPT_VERSION = '7.1.0-beta';
export const TS_LOADER_VERSION = '^10.0.0-beta.0';

interface LoadProjectOptions {
  /** Sets the plugin's `async` option in the fixture's webpack.config.js. */
  async?: boolean;
  /** Dependency versions that override the ones in the fixture's package.json. */
  dependencies?: Record<string, string>;
}

/** Copies the fixtures into the sandbox, in order, and installs their dependencies. */
export async function loadProject(
  fixtures: string | string[],
  { async, dependencies = {} }: LoadProjectOptions = {}
) {
  for (const fixture of [fixtures].flat()) {
    await sandbox.load(path.join(__dirname, 'fixtures', fixture));
  }
  await sandbox.install('yarn', dependencies);

  if (async !== undefined) {
    await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);
  }
}

/** Starts webpack-dev-server in the sandbox and returns a driver that reads its output. */
export function startDevServer(async: boolean) {
  return createWebpackDevServerDriver(
    sandbox.spawn('yarn webpack serve --mode=development'),
    async
  );
}
