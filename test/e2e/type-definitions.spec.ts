import path from 'path';

describe('Type Definitions', () => {
  it('provides valid type definitions', async () => {
    await sandbox.load(path.join(__dirname, 'fixtures/type-definitions'));
    await sandbox.install('npm', {});
    await sandbox.patch(
      'webpack.config.ts',
      'typescript: {},',
      "typescript: { configOverwrite: { extends: ['./tsconfig.base.json', './tsconfig.strict.json'] } },"
    );

    expect(await sandbox.exec('npm exec -- tsc', { fail: true })).toContain(
      "webpack.config.ts(10,7): error TS2322: Type 'string' is not assignable to type 'boolean | undefined'."
    );

    await sandbox.patch('webpack.config.ts', "async: 'invalid_value'", 'async: true');

    expect(await sandbox.exec('npm exec -- tsc')).not.toContain('error TS');

    await sandbox.patch(
      'webpack.config.ts',
      "extends: ['./tsconfig.base.json', './tsconfig.strict.json']",
      "extends: './tsconfig.base.json'"
    );
    expect(await sandbox.exec('npm exec -- tsc')).not.toContain('error TS');

    await sandbox.patch('webpack.config.ts', "extends: './tsconfig.base.json'", 'extends: []');
    expect(await sandbox.exec('npm exec -- tsc')).not.toContain('error TS');

    await sandbox.patch('webpack.config.ts', 'extends: []', 'extends: [123]');
    expect(await sandbox.exec('npm exec -- tsc', { fail: true })).toContain(
      "error TS2322: Type 'number' is not assignable to type 'string'."
    );
  });
});
