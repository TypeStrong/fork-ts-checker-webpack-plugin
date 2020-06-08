import { readFixture } from './sandbox/Fixture';
import { join } from 'path';
import { createSandbox, FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION, Sandbox } from './sandbox/Sandbox';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';

describe('Webpack Issue Scope', () => {
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
    { webpack: '4.0.0', async: true, scope: 'webpack' },
    { webpack: '4.0.0', async: false, scope: 'all' },
    { webpack: '^4.0.0', async: false, scope: 'webpack' },
    { webpack: '^4.0.0', async: true, scope: 'all' },
    { webpack: '^5.0.0-beta.16', async: true, scope: 'webpack' },
    { webpack: '^5.0.0-beta.16', async: false, scope: 'all' },
  ])(
    'reports errors only related to the given scope with %p',
    async ({ webpack, async, scope }) => {
      await sandbox.load([
        await readFixture(join(__dirname, 'fixtures/environment/typescript-basic.fixture'), {
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
            FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
          ),
          TS_LOADER_VERSION: JSON.stringify('^5.0.0'),
          TYPESCRIPT_VERSION: JSON.stringify('~3.8.0'),
          WEBPACK_VERSION: JSON.stringify(webpack),
          WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
          WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
          ASYNC: JSON.stringify(async),
        }),
        await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
      ]);

      // add importsNotUsedAsValues which is supported from TypeScript 3.8.0+
      // this option is required for proper watching of type-only files in the `transpileOnly: true` mode
      await sandbox.patch(
        './tsconfig.json',
        '    "outDir": "./dist"',
        ['    "outDir": "./dist",', '    "importsNotUsedAsValues": "preserve"'].join('\n')
      );

      // update configuration
      await sandbox.write(
        'fork-ts-checker.config.js',
        `module.exports = { issue: { scope: ${JSON.stringify(scope)} } };`
      );
      await sandbox.write('src/notUsedFile.ts', 'const x: number = "1";');

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('npm run webpack-dev-server'),
        async
      );

      // first compilation should be successful only if we use "webpack" scope
      if (scope === 'webpack') {
        await driver.waitForNoErrors();

        // add reference to the file to include it to the compilation
        await sandbox.patch(
          'src/model/User.ts',
          "import { Role } from './Role';",
          "import { Role } from './Role';\nimport '../notUsedFile';"
        );

        const errors = await driver.waitForErrors();
        expect(errors).toEqual([
          [
            'ERROR in src/notUsedFile.ts 1:7-8',
            "TS2322: Type '\"1\"' is not assignable to type 'number'.",
            '  > 1 | const x: number = "1";',
            '      |       ^',
          ].join('\n'),
        ]);

        // remove reference to the file to exclude it from the compilation
        await sandbox.patch('src/model/User.ts', "import '../notUsedFile';", '');

        await driver.waitForNoErrors();
      } else {
        const errors = await driver.waitForErrors();
        expect(errors).toEqual([
          [
            'ERROR in src/notUsedFile.ts 1:7-8',
            "TS2322: Type '\"1\"' is not assignable to type 'number'.",
            '  > 1 | const x: number = "1";',
            '      |       ^',
          ].join('\n'),
        ]);
      }
    }
  );
});
