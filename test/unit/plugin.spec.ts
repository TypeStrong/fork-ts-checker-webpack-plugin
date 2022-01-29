import { ForkTsCheckerWebpackPlugin } from 'src/plugin';

describe('plugin', () => {
  it.each([{ invalid: true }, false, null, 'unknown string', { typescript: 'invalid option' }])(
    'throws an error for invalid options %p',
    (options) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new ForkTsCheckerWebpackPlugin(options as any)).toThrowError();
    }
  );

  it('exposes current version', () => {
    expect(ForkTsCheckerWebpackPlugin.version).toEqual('{{VERSION}}'); // will be replaced by the @semantic-release/exec
  });

  it("doesn't throw an error for empty options", () => {
    expect(() => new ForkTsCheckerWebpackPlugin()).not.toThrowError();
  });

  it('accepts a custom logger', () => {
    const logger = {
      error: (message) => console.log(message),
      log: (message) => console.log(message),
    };

    expect(() => new ForkTsCheckerWebpackPlugin({ logger })).not.toThrowError();
  });
});
