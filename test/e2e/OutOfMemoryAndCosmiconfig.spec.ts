import path from 'path';
import { createProcessDriver } from 'karton';

describe('ForkTsCheckerWebpackPlugin Out Of Memory and Cosmiconfig', () => {
  it.each([
    { async: false, webpack: '4.0.0' },
    { async: true, webpack: '^4.0.0' },
    { async: false, webpack: '^5.0.0' },
    { async: true, webpack: '^5.0.0' },
  ])('handles out of memory for %p', async ({ async, webpack }) => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
    await sandbox.install('yarn', { webpack });
    await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);

    await sandbox.write(
      'fork-ts-checker.config.js',
      `module.exports = { typescript: { memoryLimit: 10 } };`
    );

    const driver = createProcessDriver(sandbox.spawn('npm run webpack-dev-server'));

    // we should see an error message about out of memory
    await driver.waitForStderrIncludes(
      'Issues checking service aborted - probably out of memory. Check the `memoryLimit` option in the ForkTsCheckerWebpackPlugin configuration.\n' +
        "If increasing the memory doesn't solve the issue, it's most probably a bug in the TypeScript."
    );

    // let's modify one file to check if plugin will try to restart the service
    await sandbox.patch(
      'src/index.ts',
      "import { getUserName } from './model/User';",
      "import { getUserName } from './model/User';\n"
    );

    // we should see an error message about out of memory again
    await driver.waitForStderrIncludes(
      'Issues checking service aborted - probably out of memory. Check the `memoryLimit` option in the ForkTsCheckerWebpackPlugin configuration.\n' +
        "If increasing the memory doesn't solve the issue, it's most probably a bug in the TypeScript."
    );
  });
});
