import path from 'path';

describe('Webpack Node Api', () => {
  it.each([{ webpack: '5.11.0' }, { webpack: '^5.11.0' }])(
    'compiles the project successfully with %p',
    async (dependencies) => {
      await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
      await sandbox.load(path.join(__dirname, 'fixtures/webpack-node-api'));
      await sandbox.install('yarn', { ...dependencies });

      const result = await sandbox.exec('node ./webpack-node-api.js');
      expect(result).toContain('Compiled successfully twice.');
    }
  );
});
