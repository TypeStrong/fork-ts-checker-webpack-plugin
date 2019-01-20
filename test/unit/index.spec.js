var describe = require('mocha').describe;
var it = require('mocha').it;
var afterEach = require('mocha').afterEach;
var expect = require('chai').expect;
var mockRequire = require('mock-require');

describe('[UNIT] ForkTsCheckerWebpackPlugin', function() {
  afterEach(function() {
    mockRequire.stopAll();
  });

  it('should throw if typescript not present', function() {
    mockRequire('typescript', undefined);
    var ForkTsCheckerWebpackPlugin = mockRequire.reRequire('../../lib/index');

    expect(function() {
      new ForkTsCheckerWebpackPlugin();
    }).to.throw(
      Error,
      'When you use this plugin you must install `typescript`.'
    );
  });

  it('should not throw if typescript version >= 2.1.0', function() {
    mockRequire('typescript', { version: '2.1.0' });
    var ForkTsCheckerWebpackPlugin = mockRequire.reRequire('../../lib/index');

    expect(function() {
      new ForkTsCheckerWebpackPlugin();
    }).to.not.throw();
  });

  it('should throw if typescript version < 2.1.0', function() {
    mockRequire('typescript', { version: '2.0.8' });
    var ForkTsCheckerWebpackPlugin = mockRequire.reRequire('../../lib/index');

    expect(function() {
      new ForkTsCheckerWebpackPlugin();
    }).to.throw(
      Error,
      'Cannot use current typescript version of 2.0.8, the minimum required version is 2.1.0'
    );
  });

  it('should throw if tslint not present', function() {
    mockRequire('typescript', { version: '2.1.0' });
    mockRequire('tslint', undefined);
    var ForkTsCheckerWebpackPlugin = mockRequire.reRequire('../../lib/index');

    expect(function() {
      new ForkTsCheckerWebpackPlugin({ tslint: true });
    }).to.throw(
      Error,
      'When you use `tslint` option, make sure to install `tslint`.'
    );
  });

  it('should not throw if tslint version >= 4.0.0', function() {
    mockRequire('typescript', { version: '2.1.0' });
    mockRequire('tslint', { Linter: { VERSION: '4.0.0' } });
    var ForkTsCheckerWebpackPlugin = mockRequire.reRequire('../../lib/index');

    expect(function() {
      new ForkTsCheckerWebpackPlugin({ tslint: true });
    }).to.not.throw();
  });

  it('should throw if tslint version < 4.0.0', function() {
    mockRequire('typescript', { version: '2.1.0' });
    mockRequire('tslint', { Linter: { VERSION: '3.15.1' } });
    var ForkTsCheckerWebpackPlugin = mockRequire.reRequire('../../lib/index');

    expect(function() {
      new ForkTsCheckerWebpackPlugin({ tslint: true });
    }).to.throw(
      Error,
      'Cannot use current tslint version of 3.15.1, the minimum required version is 4.0.0'
    );
  });
});
