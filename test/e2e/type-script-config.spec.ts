import path from 'path';

import type { WebpackDevServerDriver } from './driver/webpack-dev-server-driver';
import { createWebpackDevServerDriver } from './driver/webpack-dev-server-driver';
import { extractWebpackErrors } from './driver/webpack-errors-extractor';

describe('TypeScript Config', () => {
  it.each([
    { async: true, typescript: '~3.6.0', 'ts-loader': '^7.0.0' },
    { async: false, typescript: '~3.8.0', 'ts-loader': '^8.0.0' },
    { async: true, typescript: '~4.0.0', 'ts-loader': '^8.0.0' },
    { async: false, typescript: '~4.3.0', 'ts-loader': '^8.0.0' },
  ])(
    'change in the tsconfig.json affects compilation for %p',
    async ({ async, ...dependencies }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('npm', { ...dependencies });
      await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('npm exec -- webpack serve --mode=development'),
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

  it.each([
    { typescript: '~3.6.0' },
    { typescript: '^3.8.0' },
    { typescript: '^4.0.0' },
    { typescript: '^4.3.0' },
  ])('reports errors because of the misconfiguration', async (dependencies) => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
    await sandbox.install('npm', { ...dependencies });

    let driver: WebpackDevServerDriver;
    let errors: string[];

    await sandbox.write(
      'fork-ts-checker.config.js',
      'module.exports = { typescript: { configOverwrite: { compilerOptions: { target: "ES3", lib: ["ES3"] } } } };'
    );

    driver = createWebpackDevServerDriver(
      sandbox.spawn('npm exec -- webpack serve --mode=development'),
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
      sandbox.spawn('npm exec -- webpack serve --mode=development'),
      false
    );
    errors = await driver.waitForErrors();
    expect(errors.length).toBeGreaterThan(0);
    await sandbox.kill(driver.process);
  });

  it.each([{ typescript: '~5.0.0' }, { typescript: '~6.0.3' }])(
    'applies configOverwrite.extends in order for %p',
    async (dependencies) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-6'));
      await sandbox.install('npm', dependencies);
      await sandbox.patch('tsconfig.json', '"strict": true', '"strict": false');
      await sandbox.write(
        'tsconfig.base.json',
        JSON.stringify({ compilerOptions: { strictNullChecks: true, noImplicitAny: false } })
      );
      await sandbox.write(
        'tsconfig.strict.json',
        JSON.stringify({ compilerOptions: { noImplicitAny: true } })
      );
      await sandbox.write(
        'src/index.ts',
        'export function check(value) { const flag: boolean = undefined; return flag; }'
      );
      await sandbox.patch(
        'webpack.config.js',
        'async: false,',
        `async: false,
        typescript: {
          configOverwrite: { extends: ['./tsconfig.base.json', './tsconfig.strict.json'] },
        },`
      );

      const result = await sandbox.exec('npm exec -- webpack --mode=production', { fail: true });
      const errors = extractWebpackErrors(result);
      expect(errors).toHaveLength(2);
      expect(errors.join('\n')).toContain(
        "TS7006: Parameter 'value' implicitly has an 'any' type."
      );
      expect(errors.join('\n')).toContain(
        "TS2322: Type 'undefined' is not assignable to type 'boolean'."
      );

      await sandbox.patch(
        'webpack.config.js',
        "extends: ['./tsconfig.base.json', './tsconfig.strict.json']",
        "extends: ['./tsconfig.strict.json', './tsconfig.base.json']"
      );
      const reversedResult = await sandbox.exec('npm exec -- webpack --mode=production', {
        fail: true,
      });
      const reversedErrors = extractWebpackErrors(reversedResult);
      expect(reversedErrors).toHaveLength(1);
      expect(reversedErrors[0]).toContain(
        "TS2322: Type 'undefined' is not assignable to type 'boolean'."
      );
    }
  );
});
