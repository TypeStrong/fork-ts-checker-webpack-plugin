import { join } from 'path';
import { createSandbox, FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION, Sandbox } from './sandbox/Sandbox';
import { readFixture } from './sandbox/Fixture';
import { createGenericProcessDriver } from './sandbox/GenericProcessDriver';

describe('ForkTsCheckerWebpackPlugin Out Of Memory', () => {
  let sandbox: Sandbox;

  beforeAll(async () => {
    sandbox = await createSandbox();
  });

  beforeEach(async () => {
    await sandbox.reset();
  });

  afterAll(async () => {
    await sandbox.cleanup();
  });

  it.each([
    { async: false, webpack: '4.0.0' },
    { async: true, webpack: '^4.0.0' },
    { async: false, webpack: '^5.0.0-beta.16' },
    { async: true, webpack: '^5.0.0-beta.16' },
  ])('handles out of memory for %p', async ({ async, webpack }) => {
    await sandbox.load(
      await readFixture(join(__dirname, 'fixtures/typescript-basic.fixture'), {
        FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION,
        TS_LOADER_VERSION: '^5.0.0',
        TYPESCRIPT_VERSION: '~3.8.0',
        WEBPACK_VERSION: webpack,
        WEBPACK_CLI_VERSION: '^3.3.11',
        WEBPACK_DEV_SERVER_VERSION: '^3.10.3',
        ASYNC: async ? 'true' : 'false',
      })
    );

    await sandbox.patch(
      'webpack.config.js',
      '    new ForkTsCheckerWebpackPlugin({',
      [
        '    new ForkTsCheckerWebpackPlugin({',
        '      typescript: {',
        '        enabled: true,',
        '        memoryLimit: 10,',
        '      },',
      ].join('\n')
    );

    const driver = createGenericProcessDriver(sandbox.spawn('yarn exec webpack-dev-server'));

    // we should see an error message about out of memory
    await driver.waitForStderrIncludes(
      'Issues checking service aborted - probably out of memory. Check the `memoryLimit` option in the ForkTsCheckerWebpackPlugin configuration.\n' +
        "If increasing the memory doesn't solve the issue, it's most probably a bug in the TypeScript or EsLint."
    );

    // let's modify one file to check if plugin will try to restart the service
    await sandbox.patch(
      'src/index.ts',
      "import { getUserName } from './model/User';",
      "import { getUserName } from './model/User';\n"
    );

    // we should see an error message about out of memory again
    await driver.waitForStderrIncludes(
      'Issues checking service aborted - probably out of memory. Check the `memoryLimit` option in the ForkTsCheckerWebpackPlugin configuration.\n' +
        "If increasing the memory doesn't solve the issue, it's most probably a bug in the TypeScript or EsLint."
    );
  });
});
