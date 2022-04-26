import path, { join } from 'path';

import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';
import { createSandbox, Sandbox } from './sandbox/Sandbox';
import { readFixture } from './sandbox/Fixture';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';
import { createGenericProcessDriver } from './sandbox/GenericProcessDriver';

describe('Webpack Inclusive Watcher', () => {
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

  it.each([{ async: false }, { async: true }])(
    'ignores package.json change for %p',
    async ({ async }) => {
      await sandbox.load([
        await readFixture(path.join(__dirname, 'fixtures/environment/typescript-basic.fixture'), {
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
            FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
          ),
          TS_LOADER_VERSION: JSON.stringify('^7.0.0'),
          TYPESCRIPT_VERSION: JSON.stringify('4.6.3'),
          WEBPACK_VERSION: JSON.stringify('^5.0.0'),
          WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
          WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
          ASYNC: JSON.stringify(async),
        }),
        await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
        await readFixture(
          path.join(__dirname, 'fixtures/implementation/typescript-package.fixture')
        ),
      ]);

      // add import to typescript-nested-project project
      await sandbox.patch(
        'src/index.ts',
        "import { getUserName } from './model/User';",
        [
          "import { getUserName } from './model/User';",
          'import { sayHello } from "../package";',
          '',
          "sayHello('World');",
        ].join('\n')
      );

      // start webpack dev server
      const process = sandbox.spawn('npm run webpack-dev-server');
      const baseDriver = createGenericProcessDriver(process);
      const webpackDriver = createWebpackDevServerDriver(process, async);

      await webpackDriver.waitForNoErrors();

      // update nested package.json file
      await sandbox.patch('package/package.json', '"1.0.0"', '"1.0.1"');

      // wait for 5 seconds and fail if there is Debug Failure. in the console output
      await expect(() =>
        baseDriver.waitForStderrIncludes('Error: Debug Failure.', 5000)
      ).rejects.toEqual(
        new Error('Exceeded time on waiting for "Error: Debug Failure." to appear in the stderr.')
      );

      await webpackDriver.waitForNoErrors();
    }
  );
});
