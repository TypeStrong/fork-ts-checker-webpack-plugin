var describe = require('mocha').describe;
var it = require('mocha').it;
var beforeEach = require('mocha').beforeEach;
var afterEach = require('mocha').afterEach;
var sinon = require('sinon');
var expect = require('chai').expect;
var mockRequire = require('mock-require');

describe('[UNIT] FilesWatcher', function () {
  var FilesWatcher;
  var watcher;
  var watchStub;
  var watcherStub;

  beforeEach(function () {
    watcherStub = {
      on: sinon.stub().returnsThis()
    };
    watchStub = sinon.stub().returns(watcherStub);

    mockRequire('chokidar', { watch: watchStub });
    FilesWatcher = mockRequire.reRequire('../../lib/FilesWatcher').FilesWatcher;

    watcher = new FilesWatcher(
      ['/test', '/bar'],
      ['.ext1', '.ext2']
    );
  });

  afterEach(function () {
    mockRequire.stopAll();
  });

  it('should check if file is supported', function () {
    expect(watcher.isFileSupported('/foo.ext1')).to.be.true;
    expect(watcher.isFileSupported('/foo.ext2')).to.be.true;
    expect(watcher.isFileSupported('/foo.txt')).to.be.false;
    expect(watcher.isFileSupported('/foo.ext1.txt')).to.be.false;
  });

  it('should check if is watching file', function () {
    expect(watcher.isWatchingFile('/test/a.ext1')).to.be.false;
    expect(watcher.isWatchingFile('/test/a.txt')).to.be.false;
    expect(watcher.isWatchingFile('/test')).to.be.false;
    expect(watcher.isWatchingFile('/foo/a.ext1')).to.be.false;

    watcher.watch();

    expect(watcher.isWatchingFile('/test/a.ext1')).to.be.true;
    expect(watcher.isWatchingFile('/test/a.txt')).to.be.false;
    expect(watcher.isWatchingFile('/test')).to.be.false;
    expect(watcher.isWatchingFile('/foo/a.ext1')).to.be.false;
  });

  it('should check if watcher is watching', function () {
    expect(watcher.isWatching()).to.be.false;
    watcher.watch();
    expect(watcher.isWatching()).to.be.true;
    expect(function () { watcher.watch(); }).to.throw(Error);
  });

  it('should add and remove listeners', function () {
    var listenerA = function () {
    };
    var listenerB = function () {
    };

    expect(watcher.listeners).to.be.a('object');
    watcher.on('event', listenerA);
    watcher.on('event', listenerB);
    expect(watcher.listeners['event']).to.be.a('array');
    expect(watcher.listeners['event']).to.be.deep.equal([listenerA, listenerB]);

    watcher.off('event', listenerA);
    expect(watcher.listeners['event']).to.be.deep.equal([listenerB]);

    expect(function() { watcher.off('event', listenerA); }).to.not.throw();
    expect(watcher.listeners['event']).to.be.deep.equal([listenerB]);

    watcher.off('event', listenerB);
    expect(watcher.listeners['event']).to.be.deep.equal([]);

    expect(watcher.listeners['foo']).to.be.undefined;
    expect(function() { watcher.off('foo', listenerA); }).to.not.throw();

    expect(watcher.listeners['foo']).to.be.undefined;
  });

  it('should watch filesystem using chokidar', function () {
    expect(watchStub.called).to.be.false;

    var changeListenerA = sinon.spy();
    var changeListenerB = sinon.spy();
    var unlinkListenerA = sinon.spy();
    var unlinkListenerB = sinon.spy();

    watcher.watch();

    expect(watcherStub.on.getCall(0).args[0]).to.be.equal('change');
    expect(watcherStub.on.getCall(1).args[0]).to.be.equal('unlink');

    var triggerChange = watcherStub.on.getCall(0).args[1];
    var triggerUnlink = watcherStub.on.getCall(1).args[1];

    expect(triggerChange).to.be.a('function');
    expect(triggerUnlink).to.be.a('function');

    expect(function() { triggerChange('/test/test.ext1', {}); }).to.not.throw();
    expect(function() { triggerUnlink('/test/test.ext1', {}); }).to.not.throw();

    watcher.on('change', changeListenerA);
    watcher.on('change', changeListenerB);
    watcher.on('unlink', unlinkListenerA);
    watcher.on('unlink', unlinkListenerB);

    expect(watchStub.called).to.be.true;
    expect(watchStub.getCall(0).args[0]).to.be.equal('/test');
    expect(watchStub.getCall(1).args[0]).to.be.equal('/bar');

    // manually trigger change listeners
    triggerChange('/test/test.txt', {});
    expect(changeListenerA.called).to.be.false;
    expect(changeListenerB.called).to.be.false;

    triggerChange('/test/test.ext1', {});
    expect(changeListenerB.called).to.be.true;
    expect(changeListenerB.called).to.be.true;


    // manually trigger unlink listeners
    triggerUnlink('/test/test.txt');
    expect(unlinkListenerA.called).to.be.false;
    expect(unlinkListenerB.called).to.be.false;

    triggerUnlink('/test/test.ext1');
    expect(unlinkListenerA.called).to.be.true;
    expect(unlinkListenerB.called).to.be.true;

    // check if off is working properly
    watcher.off('change', changeListenerA);
    watcher.off('unlink', unlinkListenerB);

    triggerChange('/test/test.ext1', {});
    triggerUnlink('/test/test.ext1');

    expect(changeListenerA.callCount).to.be.equal(1);
    expect(changeListenerB.callCount).to.be.equal(2);
    expect(unlinkListenerA.callCount).to.be.equal(2);
    expect(unlinkListenerB.callCount).to.be.equal(1);
  });
});
