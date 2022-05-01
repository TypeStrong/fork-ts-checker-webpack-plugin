import path from 'path';

import semver from 'semver';

import { createWebpackDevServerDriver } from './driver/webpack-dev-server-driver';

describe('TypeScript Watch API', () => {
  it.each([{ async: false }, { async: true }])(
    'reports semantic error for %p with ts-loader',
    async ({ async }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', {});
      await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('yarn webpack serve --mode=development'),
        async
      );
      let errors: string[];

      // first compilation is successful
      await driver.waitForNoErrors();

      // then we introduce semantic error by removing "admin" role
      await sandbox.patch(
        'src/model/Role.ts',
        "type Role = 'admin' | 'client' | 'provider';",
        "type Role = 'client' | 'provider';"
      );

      // we should receive only one semantic error
      errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in ./src/index.ts:34:7',
          `TS2367: This condition will always return 'false' since the types 'Role' and '"admin"' have no overlap.`,
          '    32 |   const user = await login(email, password);',
          '    33 |',
          `  > 34 |   if (user.role === 'admin') {`,
          '       |       ^^^^^^^^^^^^^^^^^^^^^',
          '    35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
          '    36 |   } else {',
          '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
        ].join('\n'),
      ]);

      // fix the semantic error by changing condition branch related to the "admin" role
      await sandbox.patch(
        'src/index.ts',
        [
          "  if (user.role === 'admin') {",
          '    console.log(`Logged in as ${getUserName(user)} [admin].`);',
          '  } else {',
          '    console.log(`Logged in as ${getUserName(user)}`);',
          '  }',
        ].join('\n'),
        [
          "  if (user.role === 'provider') {",
          '    console.log(`Logged in as ${getUserName(user)} [provider].`);',
          '  } else {',
          '    console.log(`Logged in as ${getUserName(user)}`);',
          '  }',
        ].join('\n')
      );

      await driver.waitForNoErrors();

      // delete module to trigger another error
      await sandbox.remove('src/model/Role.ts');

      // filter-out ts-loader related errors
      errors = (await driver.waitForErrors()).filter(
        (error) => !error.includes('Module build failed') && !error.includes('Module not found')
      );
      expect(errors).toEqual([
        [
          'ERROR in ./src/model/User.ts:1:22',
          "TS2307: Cannot find module './Role' or its corresponding type declarations.",
          "  > 1 | import { Role } from './Role';",
          '      |                      ^^^^^^^^',
          '    2 |',
          '    3 | type User = {',
          '    4 |   id: string;',
        ].join('\n'),
      ]);

      // re-create deleted module
      await sandbox.write(
        'src/model/Role.ts',
        ['type Role = "admin" | "client";', '', 'export { Role };'].join('\n')
      );

      // we should receive again the one semantic error but now for "provider" role
      errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in ./src/index.ts:34:7',
          "TS2367: This condition will always return 'false' since the types 'Role' and '\"provider\"' have no overlap.",
          '    32 |   const user = await login(email, password);',
          '    33 |',
          "  > 34 |   if (user.role === 'provider') {",
          '       |       ^^^^^^^^^^^^^^^^^^^^^^^^',
          '    35 |     console.log(`Logged in as ${getUserName(user)} [provider].`);',
          '    36 |   } else {',
          '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
        ].join('\n'),
      ]);
    }
  );

  it.each([{ async: false }, { async: true }])(
    'reports semantic error for %p with babel-loader',
    async ({ async }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', {});
      await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('yarn webpack serve --mode=development'),
        async
      );
      let errors: string[];

      // first compilation is successful
      await driver.waitForNoErrors();

      // then we introduce semantic error by removing "admin" role
      await sandbox.patch(
        'src/model/Role.ts',
        "type Role = 'admin' | 'client' | 'provider';",
        "type Role = 'client' | 'provider';"
      );

      // we should receive only one semantic error
      errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in ./src/index.ts:34:7',
          `TS2367: This condition will always return 'false' since the types 'Role' and '"admin"' have no overlap.`,
          '    32 |   const user = await login(email, password);',
          '    33 |',
          `  > 34 |   if (user.role === 'admin') {`,
          '       |       ^^^^^^^^^^^^^^^^^^^^^',
          '    35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
          '    36 |   } else {',
          '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
        ].join('\n'),
      ]);

      // fix the semantic error by changing condition branch related to the "admin" role
      await sandbox.patch(
        'src/index.ts',
        [
          "  if (user.role === 'admin') {",
          '    console.log(`Logged in as ${getUserName(user)} [admin].`);',
          '  } else {',
          '    console.log(`Logged in as ${getUserName(user)}`);',
          '  }',
        ].join('\n'),
        [
          "  if (user.role === 'provider') {",
          '    console.log(`Logged in as ${getUserName(user)} [provider].`);',
          '  } else {',
          '    console.log(`Logged in as ${getUserName(user)}`);',
          '  }',
        ].join('\n')
      );

      await driver.waitForNoErrors();

      // delete module to trigger another error
      await sandbox.remove('src/model/Role.ts');

      // filter-out ts-loader related errors
      errors = (await driver.waitForErrors()).filter(
        (error) => !error.includes('Module build failed') && !error.includes('Module not found')
      );
      expect(errors).toEqual([
        [
          'ERROR in ./src/model/User.ts:1:22',
          "TS2307: Cannot find module './Role' or its corresponding type declarations.",
          "  > 1 | import { Role } from './Role';",
          '      |                      ^^^^^^^^',
          '    2 |',
          '    3 | type User = {',
          '    4 |   id: string;',
        ].join('\n'),
      ]);

      // re-create deleted module
      await sandbox.write(
        'src/model/Role.ts',
        ['type Role = "admin" | "client";', '', 'export { Role };'].join('\n')
      );

      // we should receive again the one semantic error but now for "provider" role
      errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in ./src/index.ts:34:7',
          "TS2367: This condition will always return 'false' since the types 'Role' and '\"provider\"' have no overlap.",
          '    32 |   const user = await login(email, password);',
          '    33 |',
          "  > 34 |   if (user.role === 'provider') {",
          '       |       ^^^^^^^^^^^^^^^^^^^^^^^^',
          '    35 |     console.log(`Logged in as ${getUserName(user)} [provider].`);',
          '    36 |   } else {',
          '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
        ].join('\n'),
      ]);
    }
  );

  it.each([
    { async: true, typescript: '~3.6.0', 'ts-loader': '^6.0.0' },
    { async: false, typescript: '~3.8.0', 'ts-loader': '^7.0.0' },
    { async: true, typescript: '~4.0.0', 'ts-loader': '^8.0.0' },
    { async: false, typescript: '~4.3.0', 'ts-loader': '^8.0.0' },
  ])('reports semantic error for %p long', async ({ async, ...dependencies }) => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
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
        'ERROR in ./src/model/User.ts:11:16',
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
        'ERROR in ./src/model/User.ts:11:32',
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
        'ERROR in ./src/index.ts:1:23',
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
        'ERROR in ./src/index.ts:34:12',
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
        'ERROR in ./src/index.ts:35:45',
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
        'ERROR in ./src/index.ts:37:45',
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

  it.each([
    { async: false, ignored: '[path.resolve(__dirname, "src/model/**")]' },
    { async: true, ignored: '"**/src/model/**"' },
    { async: false, ignored: '/src\\/model/' },
  ])('ignores directories from watch with %p', async ({ async, ignored }) => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
    await sandbox.install('yarn', {});
    await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);

    await sandbox.patch(
      'webpack.config.js',
      'module.exports = {',
      [
        'function forwardSlash(input) {',
        "  return path.normalize(input).replace(/\\\\+/g, '/');",
        '}',
        'module.exports = {',
      ].join('\n')
    );
    await sandbox.patch(
      'webpack.config.js',
      "  entry: './src/index.ts',",
      ["  entry: './src/index.ts',", '  watchOptions: {', `    ignored: ${ignored}`, '  },'].join(
        '\n'
      )
    );

    const driver = createWebpackDevServerDriver(
      sandbox.spawn('yarn webpack serve --mode=development'),
      async
    );

    // first compilation is successful
    await driver.waitForNoErrors();

    // then we introduce semantic error by removing "firstName" and "lastName" from the User model
    await sandbox.patch(
      'src/model/User.ts',
      ['  firstName?: string;', '  lastName?: string;'].join('\n'),
      ''
    );
    // then we add a new file in this directory
    await sandbox.write('src/model/Group.ts', '// TODO: to implement');

    // there should be no re-build
    await expect(driver.waitForNoErrors(3000)).rejects.toEqual(
      new Error('Exceeded time on waiting for no errors message to appear.')
    );
    await expect(driver.waitForErrors(3000)).rejects.toEqual(
      new Error('Exceeded time on waiting for errors to appear.')
    );
  });

  it.each([{ async: false }, { async: true }])(
    'saves .d.ts files in watch mode with %p',
    async ({ async }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', {});
      await sandbox.patch(
        'webpack.config.js',
        'async: false,',
        `async: ${JSON.stringify(async)}, typescript: { mode: 'write-dts' },`
      );

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('yarn webpack serve --mode=development'),
        async
      );

      // first compilation is successful
      await driver.waitForNoErrors();

      // then we add a new file
      await sandbox.write(
        'src/model/Organization.ts',
        [
          'interface Organization {',
          '  id: number;',
          '  name: string;',
          '}',
          '',
          'export { Organization }',
        ].join('\n')
      );

      // this should not introduce an error - file is not used
      await driver.waitForNoErrors();

      // add organization name to the getUserName function
      await sandbox.patch(
        'src/model/User.ts',
        'return [user.firstName, user.lastName]',
        'return [user.firstName, user.lastName, user.organization.name]'
      );

      expect(await driver.waitForErrors()).toEqual([
        [
          'ERROR in ./src/model/User.ts:12:47',
          "TS2339: Property 'organization' does not exist on type 'User'.",
          '    10 |',
          '    11 | function getUserName(user: User): string {',
          "  > 12 |   return [user.firstName, user.lastName, user.organization.name].filter((name) => name !== undefined).join(' ');",
          '       |                                               ^^^^^^^^^^^^',
          '    13 | }',
          '    14 |',
          '    15 | export { User, getUserName };',
        ].join('\n'),
      ]);

      // fix the error
      await sandbox.patch(
        'src/model/User.ts',
        "import { Role } from './Role';",
        ["import { Role } from './Role';", "import { Organization } from './Organization';"].join(
          '\n'
        )
      );
      await sandbox.patch(
        'src/model/User.ts',
        '  role: Role;',
        ['  role: Role;', '  organization: Organization;'].join('\n')
      );

      // there should be no errors
      await driver.waitForNoErrors();

      // check if .d.ts files has been created
      expect(await sandbox.exists('dist')).toEqual(true);
      expect(await sandbox.exists('dist/index.d.ts')).toEqual(true);
      expect(await sandbox.exists('dist/index.js')).toEqual(false);
      expect(await sandbox.exists('dist/index.js.map')).toEqual(false);
      expect(await sandbox.exists('dist/authenticate.d.ts')).toEqual(true);
      expect(await sandbox.exists('dist/model/User.d.ts')).toEqual(true);
      expect(await sandbox.exists('dist/model/Role.d.ts')).toEqual(true);
      expect(await sandbox.exists('dist/model/Organization.d.ts')).toEqual(true);

      await sandbox.remove('dist');
    }
  );
});
