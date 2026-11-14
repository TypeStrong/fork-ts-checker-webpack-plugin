import path from 'path';

import type { WebpackDevServerDriver } from './driver/webpack-dev-server-driver';
import { createWebpackDevServerDriver } from './driver/webpack-dev-server-driver';

describe('TypeScript Config', () => {
  it.each([
    { async: true, typescript: '7.1.0-beta', 'ts-loader': '^10.0.0-beta.0' },
    { async: false, typescript: '7.1.0-beta', 'ts-loader': '^10.0.0-beta.0' },
  ])(
    'change in the tsconfig.json affects compilation for %p',
    async ({ async, ...dependencies }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', { ...dependencies });
      await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('yarn webpack serve --mode=development'),
        async
      );

      // first compilation is successful
      await driver.waitForNoErrors();

      // change available libraries
      await sandbox.patch('tsconfig.json', '"lib": ["ES6", "DOM"]', '"lib": ["ES6"],');

      const errors = await driver.waitForErrors();
      expect(errors.length).toBeGreaterThan(0);

      // revert the change
      await sandbox.patch('tsconfig.json', '"lib": ["ES6"],', '"lib": ["DOM", "ES6"]');

      await driver.waitForNoErrors();
    }
  );

  it.each([{ async: true }, { async: false }])(
    'change in an extended tsconfig affects compilation for %p',
    async ({ async }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', {});
      await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);
      // move the options to a base config, extended without the `.json` extension
      await sandbox.write(
        'tsconfig.base.json',
        JSON.stringify({ compilerOptions: { lib: ['ES6', 'DOM'] } }, null, 2)
      );
      await sandbox.patch('tsconfig.json', '"lib": ["ES6", "DOM"],', '');
      await sandbox.patch('tsconfig.json', '{', '{\n  "extends": "./tsconfig.base",');

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('yarn webpack serve --mode=development'),
        async
      );

      // first compilation is successful
      await driver.waitForNoErrors();

      // change available libraries in the extended config
      await sandbox.patch('tsconfig.base.json', '"DOM"', '"ES2015"');

      const errors = await driver.waitForErrors();
      expect(errors.length).toBeGreaterThan(0);

      // revert the change
      await sandbox.patch('tsconfig.base.json', '"ES2015"', '"DOM"');

      await driver.waitForNoErrors();
    }
  );

  it('follows an extensionless extends to the file when a directory has the same name', async () => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
    await sandbox.install('yarn', {});
    await sandbox.write(
      'tsconfig.base.json',
      JSON.stringify({ compilerOptions: { lib: ['ES6', 'DOM'] } }, null, 2)
    );
    // TypeScript loads `tsconfig.base.json`, not this directory
    await sandbox.write('tsconfig.base/README.md', 'not a config');
    await sandbox.patch('tsconfig.json', '"lib": ["ES6", "DOM"],', '');
    await sandbox.patch('tsconfig.json', '{', '{\n  "extends": "./tsconfig.base",');

    const driver = createWebpackDevServerDriver(
      sandbox.spawn('yarn webpack serve --mode=development'),
      false
    );

    // first compilation is successful
    await driver.waitForNoErrors();

    // change available libraries in the extended config
    await sandbox.patch('tsconfig.base.json', '"DOM"', '"ES2015"');

    const errors = await driver.waitForErrors();
    expect(errors.length).toBeGreaterThan(0);

    // revert the change
    await sandbox.patch('tsconfig.base.json', '"ES2015"', '"DOM"');

    await driver.waitForNoErrors();
  });

  it.each([{ async: true }, { async: false }])(
    'watches include patterns that use ${configDir} for %p',
    async ({ async }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', {});
      await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);
      await sandbox.patch(
        'tsconfig.json',
        '"include": ["./src"]',
        '"include": ["${configDir}/src"]'
      );

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('yarn webpack serve --mode=development'),
        async
      );

      // first compilation is successful
      await driver.waitForNoErrors();

      // a new file that webpack doesn't import is only found through the watched include
      await sandbox.write('src/added.ts', 'export const added: number = "not a number";');

      const errors = await driver.waitForErrors();
      expect(errors.join('\n')).toContain('TS2322');

      await sandbox.remove('src/added.ts');

      await driver.waitForNoErrors();
    }
  );

  it.each([{ mode: 'write-references' }, { mode: 'write-tsbuildinfo' }])(
    'falls back to readonly without the build option for %p',
    async ({ mode }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', {});
      // with `outDir` and no `rootDir`, a program that emits reports TS5011
      await sandbox.write(
        'tsconfig.checker.json',
        JSON.stringify({
          compilerOptions: {
            target: 'es2015',
            module: 'commonjs',
            lib: ['ES6', 'DOM'],
            strict: true,
            outDir: './dist',
          },
          include: ['./src'],
        })
      );
      await sandbox.patch(
        'webpack.config.js',
        'async: false,',
        `async: false, typescript: { configFile: 'tsconfig.checker.json', mode: ${JSON.stringify(
          mode
        )} },`
      );

      const webpackProcess = sandbox.spawn('yarn webpack serve --mode=development');
      let output = '';
      webpackProcess.stdout?.on('data', (data) => (output += data));
      webpackProcess.stderr?.on('data', (data) => (output += data));
      const driver = createWebpackDevServerDriver(webpackProcess, false);

      // nothing is emitted, so there are no emit-only errors - like `tsc --noEmit`
      await driver.waitForNoErrors();
      expect(output).toContain(`The "${mode}" mode requires the "build" option`);
    }
  );

  it.each([{ typescript: '7.1.0-beta' }])(
    'reports errors because of the misconfiguration',
    async (dependencies) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', { ...dependencies });

      let driver: WebpackDevServerDriver;
      let errors: string[];

      await sandbox.write(
        'fork-ts-checker.config.js',
        'module.exports = { typescript: { configOverwrite: { compilerOptions: { target: "ES3", lib: ["ES3"] } } } };'
      );

      driver = createWebpackDevServerDriver(
        sandbox.spawn('yarn webpack serve --mode=development'),
        false
      );
      errors = await driver.waitForErrors();
      expect(errors.length).toBeGreaterThan(0);
      await sandbox.kill(driver.process);

      await sandbox.write(
        'fork-ts-checker.config.js',
        'module.exports = { typescript: { configOverwrite: { include: [] } } };'
      );

      driver = createWebpackDevServerDriver(
        sandbox.spawn('yarn webpack serve --mode=development'),
        false
      );
      errors = await driver.waitForErrors();
      expect(errors.length).toBeGreaterThan(0);
      await sandbox.kill(driver.process);
    }
  );
});
