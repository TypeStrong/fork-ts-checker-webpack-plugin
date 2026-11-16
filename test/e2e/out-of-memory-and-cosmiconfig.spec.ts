import { createProcessDriver } from 'karton';

import { loadProject } from './project';

describe('ForkTsCheckerWebpackPlugin Out Of Memory and Cosmiconfig', () => {
  it.each([{ async: false }, { async: true }])(
    'handles out of memory for %p',
    async ({ async }) => {
      await loadProject('typescript-basic', { async });

      await sandbox.write(
        'fork-ts-checker.config.js',
        // type checking runs in the native compiler, so the worker itself needs very little memory
        `module.exports = { typescript: { memoryLimit: 4 } };`
      );

      const driver = createProcessDriver(
        sandbox.spawn('npm exec -- webpack serve --mode=development')
      );

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
    }
  );
});
