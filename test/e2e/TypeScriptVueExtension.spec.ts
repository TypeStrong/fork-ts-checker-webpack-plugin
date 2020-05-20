import { createSandbox, FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION, Sandbox } from './sandbox/Sandbox';
import { readFixture } from './sandbox/Fixture';
import { join } from 'path';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';

describe('TypeScript Vue Extension', () => {
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

  it.each([{ async: true, webpack: '^4.0.0', typescript: '2.7.1', tsloader: '^5.0.0' }])(
    'reports semantic error for %p',
    async ({ async, webpack, typescript, tsloader }) => {
      await sandbox.load(
        await readFixture(join(__dirname, 'fixtures/typescript-vue.fixture'), {
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
            FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
          ),
          TS_LOADER_VERSION: JSON.stringify(tsloader),
          TYPESCRIPT_VERSION: JSON.stringify(typescript),
          WEBPACK_VERSION: JSON.stringify(webpack),
          WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
          WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
          ASYNC: JSON.stringify(async),
        })
      );

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('./node_modules/.bin/webpack-dev-server'),
        async
      );

      // first compilation is successful
      await driver.waitForNoErrors();

      // TODO: it seems that single-file components are broken on the ts-loader/typescript side
    }
  );
});
