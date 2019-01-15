var describe = require('mocha').describe;
var it = require('mocha').it;
// var beforeEach = require('mocha').beforeEach;
var afterEach = require('mocha').afterEach;
var expect = require('chai').expect;
var mockRequire = require('mock-require');

describe('[UNIT] ForkTsCheckerWebpackPlugin', function() {
  afterEach(function() {
    mockRequire.stopAll();
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
    }).to.throw();
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
    }).to.throw();
  });
});
