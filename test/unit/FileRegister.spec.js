var describe = require('mocha').describe;
var it = require('mocha').it;
var beforeEach = require('mocha').beforeEach;
var expect = require('chai').expect;
var FilesRegister = require('../../lib/FilesRegister').FilesRegister;

describe('[UNIT] FilesRegister', function() {
  var register;
  beforeEach(function() {
    register = new FilesRegister(function() {
      return {
        test: true
      };
    });
  });

  it('should add and remove files', function() {
    register.add('/test');
    register.add('/test2');
    expect(register.has('/test')).to.be.true;
    expect(register.has('/test2')).to.be.true;
    register.remove('/test');
    expect(register.has('/test')).to.be.false;
    expect(register.has('/test2')).to.be.true;

    expect(function() {
      register.remove('/test');
    }).to.not.throw();
    register.remove('/test2');
    expect(register.has('/test')).to.be.false;
    expect(register.has('/test2')).to.be.false;
  });

  it('should get file that exists in register', function() {
    register.add('/test');
    expect(function() {
      register.get('/test');
    }).to.not.throw();
    expect(function() {
      register.get('/test2');
    }).to.throw();
    expect(register.get('/test')).to.be.a('object');
    expect(Object.keys(register.get('/test'))).to.be.deep.equal([
      'mtime',
      'data'
    ]);
  });

  it('should list all keys in register', function() {
    register.add('/test');
    register.add('/test/foo');
    register.add('/test/foo/bar');
    expect(register.keys()).to.be.deep.equal([
      '/test',
      '/test/foo',
      '/test/foo/bar'
    ]);

    register.remove('/test');
    expect(register.keys()).to.be.deep.equal(['/test/foo', '/test/foo/bar']);
  });

  it('should get data from file', function() {
    register.add('/test');
    expect(register.getData('/test')).to.be.deep.equal({ test: true });
    expect(function() {
      register.getData('/test2');
    }).to.throw(Error);
  });

  it('should ensure if file exists', function() {
    expect(register.has('/test')).to.be.false;
    register.ensure('/test');
    expect(register.has('/test')).to.be.true;

    var reference = register.get('/test');
    register.ensure('/test');
    expect(reference).to.be.equal(register.get('/test'));
  });

  it('should mutate existing data', function() {
    register.add('/test');
    var dataReference = register.getData('/test');
    expect(dataReference.test).to.be.true;
    register.mutateData('/test', function(data) {
      data.test = false;
    });
    expect(dataReference).to.be.equal(register.getData('/test'));
    expect(dataReference.test).to.be.false;
  });

  it('should set mtime and reset data if mtime changes', function() {
    register.add('/test');
    register.mutateData('/test', function(data) {
      data.test = false;
    });
    expect(register.getData('/test').test).to.be.false;
    expect(register.getMtime('/test')).to.be.undefined;

    register.setMtime('/test', 1000);
    expect(register.getMtime('/test')).to.be.equal(1000);
    expect(register.getData('/test').test).to.be.true;
    register.mutateData('/test', function(data) {
      data.test = false;
    });
    expect(register.getData('/test').test).to.be.false;

    register.setMtime('/test', 1000);
    expect(register.getMtime('/test')).to.be.equal(1000);
    expect(register.getData('/test').test).to.be.false;

    register.setMtime('/test', 1001);
    expect(register.getMtime('/test')).to.be.equal(1001);
    expect(register.getData('/test').test).to.be.true;
  });
});
