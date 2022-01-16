import path from 'path';

describe('Type Definitions', () => {
  it('provides valid type definitions', async () => {
    await sandbox.load(path.join(__dirname, 'fixtures/type-definitions'));
    await sandbox.install('yarn', {});

    expect(await sandbox.exec('yarn tsc', { fail: true })).toContain(
      "webpack.config.ts(7,7): error TS2322: Type 'string' is not assignable to type 'boolean | undefined'."
    );

    await sandbox.patch('webpack.config.ts', "async: 'invalid_value'", 'async: true');

    expect(await sandbox.exec('yarn tsc')).not.toContain('error TS');
  });
});
