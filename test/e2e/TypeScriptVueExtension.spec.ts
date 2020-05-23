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

  it.each([{ async: false, typescript: '^3.8.0', tsloader: '^7.0.0' }])(
    'reports semantic error for %p',
    async ({ async, typescript, tsloader }) => {
      await sandbox.load([
        await readFixture(join(__dirname, 'fixtures/environment/typescript-vue.fixture'), {
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
            FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
          ),
          TS_LOADER_VERSION: JSON.stringify(tsloader),
          TYPESCRIPT_VERSION: JSON.stringify(typescript),
          WEBPACK_VERSION: JSON.stringify('^4.0.0'),
          WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
          WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
          ASYNC: JSON.stringify(async),
        }),
        await readFixture(join(__dirname, 'fixtures/implementation/typescript-vue.fixture')),
      ]);

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('npm run webpack-dev-server'),
        async
      );
      let errors: string[] = [];

      // first compilation is successful
      await driver.waitForNoErrors();

      // let's modify user model file
      await sandbox.patch(
        'src/component/LoggedIn.vue',
        "import User, { getUserName } from '@/model/User';",
        "import User from '@/model/User';"
      );

      // next compilation should have missing  function error
      errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in src/component/LoggedIn.vue 28:24-35',
          "TS2304: Cannot find name 'getUserName'.",
          '    26 | ',
          '    27 |   get userName() {',
          "  > 28 |     return this.user ? getUserName(this.user) : '';",
          '       |                        ^^^^^^^^^^^',
          '    29 |   }',
          '    30 | ',
          '    31 |   async logout() {',
        ].join('\n'),
      ]);

      // let's fix it
      await sandbox.patch(
        'src/component/LoggedIn.vue',
        "return this.user ? getUserName(this.user) : '';",
        "return this.user ? `${this.user.firstName} ${this.user.lastName}` : '';"
      );

      await driver.waitForNoErrors();

      // let's modify user model file again
      await sandbox.patch('src/model/User.ts', '  firstName?: string;\n', '');

      // not we should have an error about missing firstName property
      errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in src/component/LoggedIn.vue 28:37-46',
          "TS2339: Property 'firstName' does not exist on type 'User'.",
          '    26 | ',
          '    27 |   get userName() {',
          "  > 28 |     return this.user ? `${this.user.firstName} ${this.user.lastName}` : '';",
          '       |                                     ^^^^^^^^^',
          '    29 |   }',
          '    30 | ',
          '    31 |   async logout() {',
        ].join('\n'),
        [
          'ERROR in src/model/User.ts 11:16-25',
          "TS2339: Property 'firstName' does not exist on type 'User'.",
          '     9 | ',
          '    10 | function getUserName(user: User): string {',
          '  > 11 |   return [user.firstName, user.lastName]',
          '       |                ^^^^^^^^^',
          '    12 |     .filter(name => name !== undefined)',
          "    13 |     .join(' ');",
          '    14 | }',
        ].join('\n'),
      ]);
    }
  );
});
