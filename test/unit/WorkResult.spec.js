var describe = require('mocha').describe;
var it = require('mocha').it;
var beforeEach = require('mocha').beforeEach;
var expect = require('chai').expect;
var sinon = require('sinon');
var WorkResult = require('../../lib/WorkResult').WorkResult;

describe('[UNIT] WorkResult', function() {
  var result;

  beforeEach(function() {
    result = new WorkResult([1, 2, 3]);
  });

  it('should allow result only from work domain', function() {
    expect(result.supports(1)).to.be.true;
    expect(result.supports(2)).to.be.true;
    expect(result.supports(3)).to.be.true;
    expect(result.supports(4)).to.be.false;
    expect(result.supports('1')).to.be.false;
    expect(result.supports('something else')).to.be.false;
  });

  it('should throw error if we want set or get result out of work domain', function() {
    expect(function() {
      result.set(1, 'abc');
    }).to.not.throw();
    expect(function() {
      result.set(4, 'abc');
    }).to.throw();
    expect(function() {
      result.get(1);
    }).to.not.throw();
    expect(function() {
      result.get(4);
    }).to.throw();
  });

  it('should set and get result', function() {
    result.set(1, 'test');
    expect(result.has(1)).to.be.true;
    expect(result.has(2)).to.be.false;
    expect(result.get(1)).to.be.equal('test');
    expect(result.get(2)).to.be.undefined;
  });

  it('should check if we have all result', function() {
    expect(result.hasAll()).to.be.false;
    result.set(1, 'abc');
    expect(result.hasAll()).to.be.false;
    result.set(3, 'xyz');
    expect(result.hasAll()).to.be.false;
    result.set(1, 'efg');
    expect(result.hasAll()).to.be.false;
    result.set(2, undefined);
    expect(result.hasAll()).to.be.false;
    result.set(2, 'foo');
    expect(result.hasAll()).to.be.true;
  });

  it('should clear work result', function() {
    expect(function() {
      result.clear();
    }).to.not.throw();
    result.set(1, 'test');
    result.clear();
    expect(result.get(1)).to.be.undefined;
    result.set(1, 'a');
    result.set(2, 'b');
    result.set(3, 'c');
    result.clear();
    expect(result.hasAll()).to.be.false;
  });

  it('should reduce work result', function() {
    result.set(2, 'c');
    var reducer = sinon.spy(function(reduced, current) {
      return reduced.concat(current);
    });

    var reduced = result.reduce(reducer, []);
    expect(reduced).to.be.a('array');
    expect(reduced).to.be.deep.equal([undefined, 'c', undefined]);
    expect(reducer.callCount).to.be.equal(3);
    expect(reducer.getCall(0).args[0]).to.be.deep.equal([]);
    expect(reducer.getCall(0).args[1]).to.be.undefined;
    expect(reducer.getCall(1).args[0]).to.be.deep.equal([undefined]);
    expect(reducer.getCall(1).args[1]).to.be.equal('c');
    expect(reducer.getCall(2).args[0]).to.be.deep.equal([undefined, 'c']);
    expect(reducer.getCall(2).args[1]).to.be.equal(undefined);
  });
});
