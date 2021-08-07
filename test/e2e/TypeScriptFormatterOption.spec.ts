import path from 'path';
import { createWebpackDevServerDriver } from './driver/WebpackDevServerDriver';

describe('TypeScript Formatter Option', () => {
  it.each([
    { async: true, typescript: '~3.6.0' },
    { async: false, typescript: '~4.3.0' },
  ])(
    'uses the custom formatter to format the error message for %p',
    async ({ async, typescript }) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', { typescript });
      await sandbox.patch(
        'webpack.config.js',
        '      async: false,',
        [
          `      async: ${JSON.stringify(async)},`,
          '      formatter: (issue) => {',
          '        return `It is the custom issue statement - ${issue.code}: ${issue.message}`',
          '      },',
        ].join('\n')
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

      // we should receive 2 semantic errors
      const errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in ./src/model/User.ts 11:16-25',
          "It is the custom issue statement - TS2339: Property 'firstName' does not exist on type 'User'.",
        ].join('\n'),
        [
          'ERROR in ./src/model/User.ts 11:32-40',
          "It is the custom issue statement - TS2339: Property 'lastName' does not exist on type 'User'.",
        ].join('\n'),
      ]);
    }
  );
});
