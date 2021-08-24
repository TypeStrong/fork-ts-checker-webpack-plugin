import path from 'path';
import os from 'os';
import { createWebpackDevServerDriver } from './driver/WebpackDevServerDriver';

describe('TypeScript Context Option', () => {
  it.each([
    { async: true, typescript: '~3.6.0' },
    { async: false, typescript: '~3.8.0' },
    { async: true, typescript: '~4.0.0' },
    { async: false, typescript: '~4.3.0' },
  ])('uses context and cwd to resolve project files for %p', async ({ async, typescript }) => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
    await sandbox.install('yarn', { typescript });
    await sandbox.patch(
      'webpack.config.js',
      '      async: false,',
      [
        `      async: ${JSON.stringify(async)},`,
        '      typescript: {',
        '        enabled: true,',
        '        configFile: path.resolve(__dirname, "build/tsconfig.json"),',
        '        context: __dirname,',
        '      },',
      ].join('\n')
    );

    // update sandbox to use context option
    await sandbox.remove('tsconfig.json');
    await sandbox.write(
      'build/tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          target: 'es5',
          module: 'commonjs',
          lib: ['ES6', 'DOM'],
          moduleResolution: 'node',
          esModuleInterop: true,
          skipLibCheck: true,
          skipDefaultLibCheck: true,
          strict: true,
          baseUrl: './src',
          outDir: './dist',
        },
        include: ['./src'],
        exclude: ['node_modules'],
      })
    );
    await sandbox.patch(
      'webpack.config.js',
      "entry: './src/index.ts',",
      ["entry: './src/index.ts',", 'context: path.resolve(__dirname),'].join('\n')
    );
    await sandbox.patch(
      'webpack.config.js',
      '          transpileOnly: true,',
      [
        '          transpileOnly: true,',
        '          configFile: path.resolve(__dirname, "build/tsconfig.json"),',
        '          context: __dirname,',
      ].join('\n')
    );
    // create additional directory for cwd test
    await sandbox.write('foo/.gitignore', '');

    const driver = createWebpackDevServerDriver(
      sandbox.spawn(
        `../node_modules/.bin/webpack${
          os.platform() === 'win32' ? '.cmd' : ''
        } serve --mode=development --config=../webpack.config.js`,
        {
          cwd: path.join(sandbox.context, 'foo'),
        }
      ),
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
        'ERROR in ../src/model/User.ts 11:16-25',
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
        'ERROR in ../src/model/User.ts 11:32-40',
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
  });
});
