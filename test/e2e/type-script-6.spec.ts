import path from 'path';

import { createWebpackDevServerDriver } from './driver/webpack-dev-server-driver';
import { extractWebpackErrors } from './driver/webpack-errors-extractor';

describe('TypeScript 6', () => {
  it.each([{ async: false }, { async: true }])(
    'reports semantic error for %p in a TypeScript 6 project',
    async ({ async }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-6'));
      await sandbox.install('yarn', {});
      await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('yarn webpack serve --mode=development'),
        async
      );

      // first compilation is successful
      await driver.waitForNoErrors();

      // then we introduce semantic error by removing "admin" role
      await sandbox.patch(
        'src/model/Role.ts',
        "type Role = 'admin' | 'client' | 'provider';",
        "type Role = 'client' | 'provider';"
      );

      // we should receive only one semantic error
      const errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in ./src/index.ts:34:7',
          `TS2367: This comparison appears to be unintentional because the types 'Role' and '"admin"' have no overlap.`,
          '    32 |   const user = await login(email, password);',
          '    33 |',
          `  > 34 |   if (user.role === 'admin') {`,
          '       |       ^^^^^^^^^^^^^^^^^^^^^',
          '    35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
          '    36 |   } else {',
          '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
        ].join('\n'),
      ]);

      // fix the semantic error by restoring the "admin" role
      await sandbox.patch(
        'src/model/Role.ts',
        "type Role = 'client' | 'provider';",
        "type Role = 'admin' | 'client' | 'provider';"
      );

      await driver.waitForNoErrors();
    }
  );

  it('reports a deprecated compiler option as an error', async () => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-6'));
    await sandbox.install('yarn', {});

    // "moduleResolution": "node" is deprecated in TypeScript 6
    await sandbox.patch('tsconfig.json', '"module": "esnext"', '"module": "commonjs"');
    await sandbox.patch(
      'tsconfig.json',
      '"moduleResolution": "bundler"',
      '"moduleResolution": "node"'
    );

    const result = await sandbox.exec('yarn webpack --mode=production', { fail: true });
    const errors = extractWebpackErrors(result);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(
      "TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0."
    );
  });

  it('compiles the project successfully in a production build', async () => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-6'));
    await sandbox.install('yarn', {});

    const result = await sandbox.exec('yarn webpack --mode=production');
    const errors = extractWebpackErrors(result);

    expect(errors).toEqual([]);
    expect(await sandbox.exists('dist/index.js')).toEqual(true);
  });
});
