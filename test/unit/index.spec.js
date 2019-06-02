describe('[UNIT] ForkTsCheckerWebpackPlugin', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('typescript', () => {
    it('should throw if typescript not present', () => {
      jest.setMock('typescript', () => undefined);
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).toThrowError(Error);
    });

    it('should not throw if typescript version >= 2.1.0', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).not.toThrowError();
    });

    it('should throw if typescript version < 2.1.0', () => {
      jest.setMock('typescript', { version: '2.0.8' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).toThrowError(Error);
    });
  });

  describe('tslint', () => {
    it('should throw if tslint not present', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      jest.setMock('tslint', undefined);
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin({ tslint: true });
      }).toThrowError(Error);
    });

    it('should not throw if tslint version >= 4.0.0', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      jest.setMock('tslint', { Linter: { VERSION: '4.0.0' } });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin({ tslint: true });
      }).not.toThrowError();
    });

    it('should throw if tslint version < 4.0.0', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      jest.setMock('tslint', { Linter: { VERSION: '3.15.1' } });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(function() {
        new ForkTsCheckerWebpackPlugin({ tslint: true });
      }).toThrowError(Error);
    });
  });

  describe('useTypescriptIncrementalApi', () => {
    it('should be true if useTypescriptIncrementalApi: true supplied', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ useTypescriptIncrementalApi: true })
          .useTypescriptIncrementalApi
      ).toBe(true);
    });

    it('should be true if useTypescriptIncrementalApi: false supplied', () => {
      jest.setMock('typescript', { version: '3.0.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ useTypescriptIncrementalApi: false })
          .useTypescriptIncrementalApi
      ).toBe(false);
    });

    it('should be false if useTypescriptIncrementalApi not supplied and typescript version < 3.0.0', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(new ForkTsCheckerWebpackPlugin().useTypescriptIncrementalApi).toBe(
        false
      );
    });

    it('should be true if useTypescriptIncrementalApi not supplied and typescript version >= 3.0.0', () => {
      jest.setMock('typescript', { version: '3.0.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(new ForkTsCheckerWebpackPlugin().useTypescriptIncrementalApi).toBe(
        true
      );
    });

    it('should be false if useTypescriptIncrementalApi not supplied and typescript version < 3.0.0 and vue is true', () => {
      jest.setMock('typescript', { version: '2.1.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ vue: true })
          .useTypescriptIncrementalApi
      ).toBe(false);
    });

    it('should be false if useTypescriptIncrementalApi not supplied and typescript version >= 3.0.0 and vue is true', () => {
      jest.setMock('typescript', { version: '3.0.0' });
      var ForkTsCheckerWebpackPlugin = require('../../lib/index');

      expect(
        new ForkTsCheckerWebpackPlugin({ vue: true })
          .useTypescriptIncrementalApi
      ).toBe(false);
    });
  });
});
