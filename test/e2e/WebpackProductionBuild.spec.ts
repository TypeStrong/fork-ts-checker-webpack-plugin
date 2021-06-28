import path from 'path';
import stripAnsi from 'strip-ansi';
import { extractWebpackErrors } from './driver/WebpackErrorsExtractor';

describe('Webpack Production Build', () => {
  it.each([{ webpack: '4.0.0' }, { webpack: '^4.0.0' }, { webpack: '^5.0.0' }])(
    'compiles the project successfully with %p',
    async (dependencies) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', { ...dependencies });

      // lets remove the async option at all as the plugin should now how to set it by default
      await sandbox.patch(
        'webpack.config.js',
        [
          '    new ForkTsCheckerWebpackPlugin({',
          '      async: false,',
          '      logger: {',
          "        infrastructure: 'console',",
          '      },',
          '    }),',
        ].join('\n'),
        [
          '    new ForkTsCheckerWebpackPlugin({',
          '      logger: {',
          "        infrastructure: 'console',",
          '      },',
          '    }),',
        ].join('\n')
      );

      const result = await sandbox.exec('npm run webpack');
      const errors = extractWebpackErrors(result);

      expect(errors).toEqual([]);
    }
  );

  it.each([{ webpack: '4.0.0' }, { webpack: '^4.0.0' }, { webpack: '^5.0.0' }])(
    'exits with error on the project error with %p',
    async (dependencies) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.install('yarn', { ...dependencies });

      // remove the async option at all as the plugin should now how to set it by default
      await sandbox.patch(
        'webpack.config.js',
        [
          '    new ForkTsCheckerWebpackPlugin({',
          '      async: false,',
          '      logger: {',
          "        infrastructure: 'console',",
          '      },',
          '    }),',
        ].join('\n'),
        [
          '    new ForkTsCheckerWebpackPlugin({',
          '      logger: {',
          "        infrastructure: 'console',",
          '      },',
          '    }),',
        ].join('\n')
      );

      // introduce an error in the project
      await sandbox.remove('src/model/User.ts');
      const result = await sandbox.exec('npm run webpack', { fail: true });

      // remove npm related output
      const output = stripAnsi(String(result)).replace(/npm (ERR!|WARN).*/g, '');
      // extract errors
      const errors = extractWebpackErrors(output);

      expect(errors).toEqual([
        // first error is from the webpack module resolution
        expect.anything(),
        [
          'ERROR in src/authenticate.ts:1:22',
          "TS2307: Cannot find module './model/User' or its corresponding type declarations.",
          "  > 1 | import { User } from './model/User';",
          '      |                      ^^^^^^^^^^^^^^',
          '    2 |',
          '    3 | async function login(email: string, password: string): Promise<User> {',
          "    4 |   const response = await fetch('/login', {",
        ].join('\n'),
        [
          'ERROR in src/index.ts:2:29',
          "TS2307: Cannot find module './model/User' or its corresponding type declarations.",
          "    1 | import { login } from './authenticate';",
          "  > 2 | import { getUserName } from './model/User';",
          '      |                             ^^^^^^^^^^^^^^',
          '    3 |',
          "    4 | const emailInput = document.getElementById('email');",
          "    5 | const passwordInput = document.getElementById('password');",
        ].join('\n'),
      ]);
    }
  );
});
