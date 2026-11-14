import fs from 'fs';
import os from 'os';
import path from 'path';

import { ForkTsCheckerWebpackPlugin } from 'src/plugin';

describe('plugin', () => {
  it.each([{ invalid: true }, false, null, 'unknown string', { typescript: 'invalid option' }])(
    'throws an error for invalid options %p',
    (options) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new ForkTsCheckerWebpackPlugin(options as any)).toThrow();
    }
  );

  it('exposes current version', () => {
    expect(ForkTsCheckerWebpackPlugin.version).toEqual('{{VERSION}}'); // will be replaced by the @semantic-release/exec
  });

  it("doesn't throw an error for empty options", () => {
    expect(() => new ForkTsCheckerWebpackPlugin()).not.toThrow();
  });

  it('finds a configuration file in a parent directory', () => {
    const cwd = process.cwd();
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fork-ts-checker-')));
    try {
      // an invalid option, so finding the file makes the constructor throw
      fs.writeFileSync(path.join(root, '.fork-ts-checkerrc'), JSON.stringify({ invalid: true }));
      fs.mkdirSync(path.join(root, 'packages', 'app'), { recursive: true });
      process.chdir(path.join(root, 'packages', 'app'));

      expect(() => new ForkTsCheckerWebpackPlugin()).toThrow();
    } finally {
      process.chdir(cwd);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts a custom logger', () => {
    const logger = {
      error: (message) => console.log(message),
      log: (message) => console.log(message),
    };

    expect(() => new ForkTsCheckerWebpackPlugin({ logger })).not.toThrow();
  });
});
