/* eslint-disable @typescript-eslint/no-var-requires */
describe('[UNIT] ForkTsCheckerWebpackPlugin', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('typescript', () => {
    it('should throw if typescript not present', () => {
      jest.setMock('typescript', () => undefined);
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).toThrowError(Error);
    });

    it('should not throw if typescript version >= 2.1.0', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).not.toThrowError();
    });

    it('should throw if typescript version < 2.1.0', () => {
      jest.setMock('typescript', { version: '2.0.8' });
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).toThrowError(Error);
    });
  });

  describe('eslint', () => {
    it('should throw if eslint not present', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      jest.setMock('eslint', undefined);
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin({ eslint: true });
      }).toThrowError(Error);
    });

    it('should not throw if eslint is present', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      jest.setMock('eslint', { Linter: { VERSION: '5.7.0' } });
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin({ eslint: true });
      }).not.toThrowError();
    });
  });

  describe('useTypescriptIncrementalApi', () => {
    it('should be true if useTypescriptIncrementalApi: true supplied', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ useTypescriptIncrementalApi: true })
          .useTypescriptIncrementalApi
      ).toBe(true);
    });

    it('should be true if useTypescriptIncrementalApi: false supplied', () => {
      jest.setMock('typescript', { version: '3.0.0' });
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ useTypescriptIncrementalApi: false })
          .useTypescriptIncrementalApi
      ).toBe(false);
    });

    it('should be false if useTypescriptIncrementalApi not supplied and typescript version < 3.0.0', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(new ForkTsCheckerWebpackPlugin().useTypescriptIncrementalApi).toBe(
        false
      );
    });

    it('should be true if useTypescriptIncrementalApi not supplied and typescript version >= 3.0.0', () => {
      jest.setMock('typescript', { version: '3.0.0' });
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(new ForkTsCheckerWebpackPlugin().useTypescriptIncrementalApi).toBe(
        true
      );
    });

    it('should be false if useTypescriptIncrementalApi not supplied and typescript version < 3.0.0 and vue is true', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ vue: true })
          .useTypescriptIncrementalApi
      ).toBe(false);
    });

    it('should be false if useTypescriptIncrementalApi not supplied and typescript version >= 3.0.0 and vue is true', () => {
      jest.setMock('typescript', { version: '3.0.0' });
      const ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ vue: true })
          .useTypescriptIncrementalApi
      ).toBe(false);
    });
  });
});
