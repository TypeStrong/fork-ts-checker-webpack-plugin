import path from 'path';
import { createWebpackDevServerDriver } from './driver/WebpackDevServerDriver';
import semver from 'semver';

describe('TypeScript PnP Support', () => {
  it.each([
    { async: true, typescript: '~3.6.0', 'ts-loader': '^7.0.0' },
    { async: false, typescript: '~4.0.0', 'ts-loader': '^8.0.0' },
    { async: true, typescript: '~4.3.0', 'ts-loader': '^8.0.0' },
  ])('reports semantic error for %p', async ({ async, ...dependencies }) => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-pnp'));
    await sandbox.install('yarn', { ...dependencies });
    await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);

    const driver = createWebpackDevServerDriver(
      sandbox.spawn('yarn webpack serve --mode=development'),
      async
    );
    let errors: string[];

    // first compilation is successful
    await driver.waitForNoErrors();

    // then we introduce semantic error by removing "firstName" and "lastName" from the User model
    await sandbox.patch(
      'src/model/User.ts',
      ['  firstName?: string;', '  lastName?: string;'].join('\n'),
      ''
    );

    // we should receive 2 semantic errors
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in ./src/model/User.ts 11:16-25',
        "TS2339: Property 'firstName' does not exist on type 'User'.",
        '     9 |',
        '    10 | function getUserName(user: User): string {',
        "  > 11 |   return [user.firstName, user.lastName].filter((name) => name !== undefined).join(' ');",
        '       |                ^^^^^^^^^',
        '    12 | }',
        '    13 |',
        '    14 | export { User, getUserName };',
      ].join('\n'),
      [
        'ERROR in ./src/model/User.ts 11:32-40',
        "TS2339: Property 'lastName' does not exist on type 'User'.",
        '     9 |',
        '    10 | function getUserName(user: User): string {',
        "  > 11 |   return [user.firstName, user.lastName].filter((name) => name !== undefined).join(' ');",
        '       |                                ^^^^^^^^',
        '    12 | }',
        '    13 |',
        '    14 | export { User, getUserName };',
      ].join('\n'),
    ]);

    // fix the semantic error
    await sandbox.patch(
      'src/model/User.ts',
      "  return [user.firstName, user.lastName].filter((name) => name !== undefined).join(' ');",
      '  return user.email;'
    );

    await driver.waitForNoErrors();

    // delete module to trigger another error
    await sandbox.remove('src/authenticate.ts');

    errors = await driver.waitForErrors();
    expect(errors).toContain(
      [
        'ERROR in ./src/index.ts 1:23-39',
        semver.satisfies(semver.minVersion(dependencies.typescript), '>=4.0.0')
          ? "TS2307: Cannot find module './authenticate' or its corresponding type declarations."
          : "TS2307: Cannot find module './authenticate'.",
        "  > 1 | import { login } from './authenticate';",
        '      |                       ^^^^^^^^^^^^^^^^',
        "    2 | import { getUserName } from './model/User';",
        '    3 |',
        "    4 | const emailInput = document.getElementById('email');",
      ].join('\n')
    );

    // re-create deleted module
    await sandbox.write(
      'src/authenticate.ts',
      [
        "import { User } from './model/User';",
        '',
        'async function login(email: string, password: string): Promise<void> {',
        '  await fetch(',
        "    '/login',",
        '    {',
        "      method: 'POST',",
        '      body: JSON.stringify({ email, password })',
        '    }',
        '  );',
        '}',
        '',
        'async function logout(): Promise<any> {',
        '  const response = await fetch(',
        "    '/logout',",
        '    {',
        "      method: 'POST'",
        '    }',
        '  );',
        '  return response.json();',
        '}',
        '',
        'export { login, logout };',
      ].join('\n')
    );

    // we should receive again 3 semantic errors
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in ./src/index.ts 34:12-16',
        "TS2339: Property 'role' does not exist on type 'void'.",
        '    32 |   const user = await login(email, password);',
        '    33 |',
        "  > 34 |   if (user.role === 'admin') {",
        '       |            ^^^^',
        '    35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
        '    36 |   } else {',
        '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
      ].join('\n'),
      [
        'ERROR in ./src/index.ts 35:45-49',
        "TS2345: Argument of type 'void' is not assignable to parameter of type 'User'.",
        '    33 |',
        "    34 |   if (user.role === 'admin') {",
        '  > 35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
        '       |                                             ^^^^',
        '    36 |   } else {',
        '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
        '    38 |   }',
      ].join('\n'),
      [
        'ERROR in ./src/index.ts 37:45-49',
        "TS2345: Argument of type 'void' is not assignable to parameter of type 'User'.",
        '    35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
        '    36 |   } else {',
        '  > 37 |     console.log(`Logged in as ${getUserName(user)}`);',
        '       |                                             ^^^^',
        '    38 |   }',
        '    39 | });',
        '    40 |',
      ].join('\n'),
    ]);
  });
});
