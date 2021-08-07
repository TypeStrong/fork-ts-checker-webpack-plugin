import path from 'path';
import {
  createWebpackDevServerDriver,
  WebpackDevServerDriver,
} from './driver/WebpackDevServerDriver';

describe('TypeScript Configuration', () => {
  it.each([
    { async: true, typescript: '~3.6.0', 'ts-loader': '^7.0.0' },
    { async: false, typescript: '~3.8.0', 'ts-loader': '^8.0.0' },
    { async: true, typescript: '~4.0.0', 'ts-loader': '^8.0.0' },
    { async: false, typescript: '~4.3.0', 'ts-loader': '^8.0.0' },
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

  it.each([
    { typescript: '~3.6.0' },
    { typescript: '^3.8.0' },
    { typescript: '^4.0.0' },
    { typescript: '^4.3.0' },
  ])('reports errors because of the misconfiguration', async (dependencies) => {
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
  });
});
