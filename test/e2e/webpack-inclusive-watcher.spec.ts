import path from 'path';

import { createProcessDriver } from 'karton';

import { createWebpackDevServerDriver } from './driver/webpack-dev-server-driver';

describe('Webpack Inclusive Watcher', () => {
  it.each([{ async: false }, { async: true }])(
    'ignores package.json change for %p',
    async ({ async }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-package'));
      await sandbox.install('yarn', { typescript: '4.6.3' });
      await sandbox.patch('webpack.config.js', 'async: false,', `async: ${JSON.stringify(async)},`);

      // add import to typescript-nested-project project
      await sandbox.patch(
        'src/index.ts',
        "import { getUserName } from './model/User';",
        [
          "import { getUserName } from './model/User';",
          'import { sayHello } from "../package";',
          '',
          "sayHello('World');",
        ].join('\n')
      );

      // start webpack dev server
      const process = sandbox.spawn('yarn webpack serve --mode=development');
      const baseDriver = createProcessDriver(process);
      const webpackDriver = createWebpackDevServerDriver(process, async);

      await webpackDriver.waitForNoErrors();

      // update nested package.json file
      await sandbox.patch('package/package.json', '"1.0.0"', '"1.0.1"');

      // wait for 5 seconds and fail if there is Debug Failure. in the console output
      await expect(() =>
        baseDriver.waitForStderrIncludes('Error: Debug Failure.', 5000)
      ).rejects.toEqual(
        new Error('Exceeded time on waiting for "Error: Debug Failure." to appear in the stderr.')
      );

      await webpackDriver.waitForNoErrors();
    }
  );
});
