import path from 'path';
import { createWebpackDevServerDriver } from './driver/WebpackDevServerDriver';

describe('TypeScript Vue Extension', () => {
  it.each([
    {
      async: false,
      compiler: 'vue-template-compiler',
      typescript: '^3.8.0',
      'ts-loader': '^7.0.0',
      'vue-loader': '^15.8.3',
      vue: '^2.6.11',
      'vue-template-compiler': '^2.6.11',
    },
    {
      async: true,
      compiler: '@vue/compiler-sfc',
      typescript: '^3.8.0',
      'ts-loader': '^7.0.0',
      'vue-loader': 'v16.0.0-beta.3',
      vue: '^3.0.0-beta.14',
      '@vue/compiler-sfc': '^3.0.0-beta.14',
    },
  ])('reports semantic error for %p', async ({ async, compiler, ...dependencies }) => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-vue'));
    await sandbox.install('yarn', { ...dependencies });
    await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);
    await sandbox.patch(
      'webpack.config.js',
      "compiler: 'vue-template-compiler',",
      `compiler: ${JSON.stringify(compiler)},`
    );

    if (dependencies.vue === '^2.6.11') {
      await sandbox.write(
        'src/vue-shim.d.ts',
        ['declare module "*.vue" {', '  import Vue from "vue";', '  export default Vue;', '}'].join(
          '\n'
        )
      );
    } else {
      await sandbox.write('src/vue-shim.d.ts', 'declare module "*.vue";');
    }

    const driver = createWebpackDevServerDriver(
      sandbox.spawn('yarn webpack serve --mode=development'),
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
        'ERROR in ./src/component/LoggedIn.vue 27:23-34',
        "TS2304: Cannot find name 'getUserName'.",
        '    25 |         const user: User = this.user;',
        '    26 |',
        "  > 27 |         return user ? getUserName(user) : '';",
        '       |                       ^^^^^^^^^^^',
        '    28 |       }',
        '    29 |     },',
        '    30 |     async logout() {',
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
        'ERROR in ./src/component/LoggedIn.vue 27:31-40',
        "TS2339: Property 'firstName' does not exist on type 'User'.",
        '    25 |         const user: User = this.user;',
        '    26 |',
        "  > 27 |         return user ? `${user.firstName} ${user.lastName}` : '';",
        '       |                               ^^^^^^^^^',
        '    28 |       }',
        '    29 |     },',
        '    30 |     async logout() {',
      ].join('\n'),
      [
        'ERROR in ./src/model/User.ts 11:16-25',
        "TS2339: Property 'firstName' does not exist on type 'User'.",
        '     9 |',
        '    10 | function getUserName(user: User): string {',
        "  > 11 |   return [user.firstName, user.lastName].filter((name) => name !== undefined).join(' ');",
        '       |                ^^^^^^^^^',
        '    12 | }',
        '    13 |',
        '    14 | export default User;',
      ].join('\n'),
    ]);
  });
});
