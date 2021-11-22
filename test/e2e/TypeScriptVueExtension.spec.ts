import { join } from 'path';
import { createSandbox, Sandbox } from './sandbox/Sandbox';
import { readFixture } from './sandbox/Fixture';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';
import semver from 'semver/preload';

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

  it.each([
    {
      async: false,
      typescript: '^3.8.0',
      tsloader: '^7.0.0',
      vueloader: '^15.8.3',
      vue: '^2.0.0',
      compiler: 'vue-template-compiler',
      qrcodevue: '^1.7.0',
    },
    {
      async: true,
      typescript: '^3.8.0',
      tsloader: '^7.0.0',
      vueloader: 'v16.8.3',
      vue: '^3.0.0',
      compiler: '@vue/compiler-sfc',
      qrcodevue: '^3.0.0',
    },
  ])(
    'reports semantic error for %p',
    async ({ async, typescript, tsloader, vueloader, vue, compiler, qrcodevue }) => {
      const fixtures = [
        await readFixture(join(__dirname, 'fixtures/environment/typescript-vue.fixture'), {
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
            FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
          ),
          TS_LOADER_VERSION: JSON.stringify(tsloader),
          TYPESCRIPT_VERSION: JSON.stringify(typescript),
          WEBPACK_VERSION: JSON.stringify('^4.0.0'),
          WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
          WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
          VUE_LOADER_VERSION: JSON.stringify(vueloader),
          VUE_VERSION: JSON.stringify(vue),
          VUE_COMPILER: JSON.stringify(compiler),
          QRCODE_VUE_VERSION: JSON.stringify(qrcodevue),
          ASYNC: JSON.stringify(async),
        }),
        await readFixture(join(__dirname, 'fixtures/implementation/typescript-vue-shared.fixture')),
      ];
      if (semver.satisfies('2.0.0', vue)) {
        fixtures.push(
          await readFixture(join(__dirname, 'fixtures/implementation/typescript-vue2.fixture'))
        );
      } else if (semver.satisfies('3.0.0', vue)) {
        fixtures.push(
          await readFixture(join(__dirname, 'fixtures/implementation/typescript-vue3.fixture'))
        );
      }
      await sandbox.load(fixtures);

      if (semver.satisfies('2.0.0', vue)) {
        await sandbox.write(
          'src/vue-shim.d.ts',
          [
            'declare module "*.vue" {',
            '  import Vue from "vue";',
            '  export default Vue;',
            '}',
          ].join('\n')
        );
      } else if (semver.satisfies('3.0.0', vue)) {
        await sandbox.write('src/vue-shim.d.ts', 'declare module "*.vue";');
      }

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('npm run webpack-dev-server'),
        async
      );
      let errors: string[] = [];

      // first compilation is successful
      await driver.waitForNoErrors();

      // modify user model file
      await sandbox.patch(
        'src/component/LoggedIn.vue',
        "import User, { getUserName } from '@/model/User';",
        "import User from '@/model/User';"
      );

      // next compilation should have missing  function error
      errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in src/component/LoggedIn.vue:27:21',
          "TS2304: Cannot find name 'getUserName'.",
          '    25 |       const user: User = this.user;',
          '    26 |',
          "  > 27 |       return user ? getUserName(user) : '';",
          '       |                     ^^^^^^^^^^^',
          '    28 |     }',
          '    29 |   },',
          '    30 |   async logout() {',
        ].join('\n'),
      ]);

      // fix it
      await sandbox.patch(
        'src/component/LoggedIn.vue',
        "return user ? getUserName(user) : '';",
        "return user ? `${user.firstName} ${user.lastName}` : '';"
      );

      await driver.waitForNoErrors();

      // modify user model file again
      await sandbox.patch('src/model/User.ts', '  firstName?: string;\n', '');

      // not we should have an error about missing firstName property
      errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in src/component/LoggedIn.vue:27:29',
          "TS2339: Property 'firstName' does not exist on type 'User'.",
          '    25 |       const user: User = this.user;',
          '    26 |',
          "  > 27 |       return user ? `${user.firstName} ${user.lastName}` : '';",
          '       |                             ^^^^^^^^^',
          '    28 |     }',
          '    29 |   },',
          '    30 |   async logout() {',
        ].join('\n'),
        [
          'ERROR in src/model/User.ts:11:16',
          "TS2339: Property 'firstName' does not exist on type 'User'.",
          '     9 |',
          '    10 | function getUserName(user: User): string {',
          '  > 11 |   return [user.firstName, user.lastName]',
          '       |                ^^^^^^^^^',
          '    12 |     .filter(name => name !== undefined)',
          "    13 |     .join(' ');",
          '    14 | }',
        ].join('\n'),
      ]);

      // fix the error
      await sandbox.patch(
        'src/model/User.ts',
        '  lastName?: string;',
        ['  firstName?: string;', '  lastName?: string;'].join('\n')
      );
      await driver.waitForNoErrors();

      if (semver.satisfies('3.0.0', vue)) {
        await sandbox.patch(
          'src/component/Header.vue',
          'defineProps({',
          ['let x: number = "1"', 'defineProps({'].join('\n')
        );

        errors = await driver.waitForErrors();
        expect(errors).toEqual([
          [
            'ERROR in src/component/Header.vue:6:5',
            "TS2322: Type '\"1\"' is not assignable to type 'number'.",
            '    4 |',
            '    5 | <script setup lang="ts">',
            '  > 6 | let x: number = "1"',
            '      |     ^',
            '    7 | defineProps({',
            '    8 |   title: String,',
            '    9 | });',
          ].join('\n'),
        ]);
        // fix the issue
        await sandbox.patch('src/component/Header.vue', 'let x: number = "1"', '');
        await driver.waitForNoErrors();

        // introduce error in second <script>
        await sandbox.patch(
          'src/component/Logo.vue',
          'export default {',
          ['let x: number = "1";', 'export default {'].join('\n')
        );

        errors = await driver.waitForErrors();
        expect(errors).toEqual([
          [
            'ERROR in src/component/Logo.vue:15:5',
            "TS2322: Type '\"1\"' is not assignable to type 'number'.",
            '    13 |',
            '    14 | <script lang="ts">',
            '  > 15 | let x: number = "1";',
            '       |     ^',
            '    16 | export default {',
            '    17 |   inheritAttrs: false,',
            '    18 |   customOptions: {}',
          ].join('\n'),
        ]);
      }
    }
  );
});
