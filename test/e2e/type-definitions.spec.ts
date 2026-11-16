import { loadProject } from './project';

describe('Type Definitions', () => {
  it('provides valid type definitions', async () => {
    await loadProject('type-definitions');

    expect(await sandbox.exec('npm exec -- tsc', { fail: true })).toContain(
      "webpack.config.ts(10,7): error TS2322: Type 'string' is not assignable to type 'boolean | undefined'."
    );

    await sandbox.patch('webpack.config.ts', "async: 'invalid_value'", 'async: true');

    expect(await sandbox.exec('npm exec -- tsc')).not.toContain('error TS');
  });
});
