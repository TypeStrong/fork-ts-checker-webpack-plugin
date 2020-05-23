import { ForkTsCheckerWebpackPlugin } from 'lib/ForkTsCheckerWebpackPlugin';

describe('ForkTsCheckerWebpackPlugin', () => {
  it.each([{ invalid: true }, false, null, 'unknown string', { typescript: 'invalid option' }])(
    'throws an error for invalid options %p',
    (options) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new ForkTsCheckerWebpackPlugin(options as any)).toThrowError();
    }
  );

  it("doesn't throw an error for empty options", () => {
    expect(() => new ForkTsCheckerWebpackPlugin()).not.toThrowError();
  });
});
