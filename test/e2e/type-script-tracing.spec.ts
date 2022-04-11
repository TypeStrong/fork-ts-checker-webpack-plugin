import path from 'path';

import { extractWebpackErrors } from './driver/webpack-errors-extractor';

describe('TypeScript Tracing', () => {
  it.each([
    { build: false, typescript: '~4.3.0' },
    { build: true, typescript: '~4.3.0' },
    { build: false, typescript: '~4.6.0' },
    { build: true, typescript: '~4.6.0' },
  ])('can generate trace files for %p', async ({ build, ...dependencies }) => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
    await sandbox.install('yarn', { ...dependencies });

    // enable tracing
    await sandbox.patch(
      'tsconfig.json',
      '"outDir": "./dist"',
      '"outDir": "./dist",\n"generateTrace": "./traces"'
    );

    await sandbox.write(
      'fork-ts-checker.config.js',
      `module.exports = ${JSON.stringify({ typescript: { build } })};`
    );

    const webpackResult = await sandbox.exec('yarn webpack --mode=development');
    const errors = extractWebpackErrors(webpackResult);
    expect(errors).toEqual([]);

    expect(await sandbox.exists('dist')).toEqual(true);

    expect(await sandbox.list('./traces')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: expect.stringMatching(/types.*\.json/) }),
        expect.objectContaining({ name: expect.stringMatching(/trace.*\.json/) }),
      ])
    );
  });
});
