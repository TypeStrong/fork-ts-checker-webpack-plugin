var describe = require('mocha').describe;
var it = require('mocha').it;
var expect = require('chai').expect;
var ForkTsCheckerWebpackPlugin = require('../../lib/index');

describe('[UNIT] index', function () {

  it('should allow to pass no options', function () {
    expect(function () {
      new ForkTsCheckerWebpackPlugin();
    }).to.not.throw.error;
  });

  it('should detect paths', function () {
    var plugin = new ForkTsCheckerWebpackPlugin({ tslint: true });

    expect(plugin.tsconfig).to.be.equal('./tsconfig.json');
    expect(plugin.tslint).to.be.equal('./tslint.json');
  });

  it('should set logger to console by default', function () {
    var plugin = new ForkTsCheckerWebpackPlugin({ });

    expect(plugin.logger).to.be.equal(console);
  });

  it('should set watch to empty array by default', function () {
    var plugin = new ForkTsCheckerWebpackPlugin({ });

    expect(plugin.watch).to.be.deep.equal([]);
  });

  it('should set watch to one element array for string', function () {
    var plugin = new ForkTsCheckerWebpackPlugin({ watch: '/test' });

    expect(plugin.watch).to.be.deep.equal(['/test']);
  });

});
