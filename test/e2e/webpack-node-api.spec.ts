import { loadProject } from './project';

describe('Webpack Node Api', () => {
  it.each([{ webpack: '5.54.0' }, { webpack: '^5.54.0' }])(
    'compiles the project successfully with %p',
    async (dependencies) => {
      await loadProject(['typescript-basic', 'webpack-node-api'], { dependencies });

      const result = await sandbox.exec('node ./webpack-node-api.js');
      expect(result).toContain('Compiled successfully twice.');
    }
  );
});
