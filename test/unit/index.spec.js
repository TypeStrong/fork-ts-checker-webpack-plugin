describe('[UNIT] ForkTsCheckerWebpackPlugin', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('typescript', () => {
    test('should throw if typescript not present', () => {
      jest.setMock('typescript', () => undefined);
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).toThrowError(Error);
    });

    test('should not throw if typescript version >= 2.1.0', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).not.toThrowError();
    });

    test('should throw if typescript version < 2.1.0', () => {
      jest.setMock('typescript', { version: '2.0.8' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).toThrowError(Error);
    });
  });

  describe('tslint', () => {
    test('should throw if tslint not present', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      jest.setMock('tslint', undefined);
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin({ tslint: true });
      }).toThrowError(Error);
    });

    test('should not throw if tslint version >= 4.0.0', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      jest.setMock('tslint', { Linter: { VERSION: '4.0.0' } });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin({ tslint: true });
      }).not.toThrowError();
    });

    test('should throw if tslint version < 4.0.0', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      jest.setMock('tslint', { Linter: { VERSION: '3.15.1' } });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin({ tslint: true });
      }).toThrowError(Error);
    });
  });

  describe('useTypescriptIncrementalApi', () => {
    test('should be true if useTypescriptIncrementalApi: true supplied', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ useTypescriptIncrementalApi: true })
          .useTypescriptIncrementalApi
      ).toBe(true);
    });

    test('should be true if useTypescriptIncrementalApi: false supplied', () => {
      jest.setMock('typescript', { version: '3.0.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ useTypescriptIncrementalApi: false })
          .useTypescriptIncrementalApi
      ).toBe(false);
    });

    test('should be false if useTypescriptIncrementalApi not supplied and typescript version < 3.0.0', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(new ForkTsCheckerWebpackPlugin().useTypescriptIncrementalApi).toBe(
        false
      );
    });

    test('should be true if useTypescriptIncrementalApi not supplied and typescript version >= 3.0.0', () => {
      jest.setMock('typescript', { version: '3.0.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(new ForkTsCheckerWebpackPlugin().useTypescriptIncrementalApi).toBe(
        true
      );
    });

    test('should be false if useTypescriptIncrementalApi not supplied and typescript version < 3.0.0 and vue is true', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ vue: true })
          .useTypescriptIncrementalApi
      ).toBe(false);
    });

    test('should be false if useTypescriptIncrementalApi not supplied and typescript version >= 3.0.0 and vue is true', () => {
      jest.setMock('typescript', { version: '3.0.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ vue: true })
          .useTypescriptIncrementalApi
      ).toBe(false);
    });
  });
});
