var mockRequire = require('mock-require');

describe('[UNIT] FilesWatcher', () => {
  var FilesWatcher;
  var watcher;
  var watchStub;
  var watcherStub;

  beforeEach(() => {
    jest.resetModules();

    watcherStub = {
      on: jest.fn(function() {
        return this;
      })
    };
    watchStub = jest.fn(function() {
      return watcherStub;
    });

    jest.setMock('chokidar', { watch: watchStub });
    FilesWatcher = require('../../lib/FilesWatcher').FilesWatcher;

    watcher = new FilesWatcher(['/test', '/bar'], ['.ext1', '.ext2']);
  });

  afterEach(() => {
    mockRequire.stopAll();
  });

  test('should check if file is supported', () => {
    expect(watcher.isFileSupported('/foo.ext1')).toBe(true);
    expect(watcher.isFileSupported('/foo.ext2')).toBe(true);
    expect(watcher.isFileSupported('/foo.txt')).toBe(false);
    expect(watcher.isFileSupported('/foo.ext1.txt')).toBe(false);
  });

  test('should check if is watching file', () => {
    expect(watcher.isWatchingFile('/test/a.ext1')).toBe(false);
    expect(watcher.isWatchingFile('/test/a.txt')).toBe(false);
    expect(watcher.isWatchingFile('/test')).toBe(false);
    expect(watcher.isWatchingFile('/foo/a.ext1')).toBe(false);

    watcher.watch();

    expect(watcher.isWatchingFile('/test/a.ext1')).toBe(true);
    expect(watcher.isWatchingFile('/test/a.txt')).toBe(false);
    expect(watcher.isWatchingFile('/test')).toBe(false);
    expect(watcher.isWatchingFile('/foo/a.ext1')).toBe(false);
  });

  test('should check if watcher is watching', () => {
    expect(watcher.isWatching()).toBe(false);
    watcher.watch();
    expect(watcher.isWatching()).toBe(true);
    expect(function() {
      watcher.watch();
    }).toThrowError(Error);
  });

  test('should add and remove listeners', () => {
    var listenerA = function() {};
    var listenerB = function() {};

    expect(typeof watcher.listeners).toBe('object');
    watcher.on('event', listenerA);
    watcher.on('event', listenerB);
    expect(Array.isArray(watcher.listeners['event'])).toBe(true);
    expect(watcher.listeners['event']).toEqual([listenerA, listenerB]);

    watcher.off('event', listenerA);
    expect(watcher.listeners['event']).toEqual([listenerB]);

    expect(function() {
      watcher.off('event', listenerA);
    }).not.toThrowError();
    expect(watcher.listeners['event']).toEqual([listenerB]);

    watcher.off('event', listenerB);
    expect(watcher.listeners['event']).toEqual([]);

    expect(watcher.listeners['foo']).toBeUndefined();
    expect(function() {
      watcher.off('foo', listenerA);
    }).not.toThrowError();

    expect(watcher.listeners['foo']).toBeUndefined();
  });

  test('should watch filesystem using chokidar', () => {
    expect(watchStub).not.toHaveBeenCalled();

    var changeListenerA = jest.fn();
    var changeListenerB = jest.fn();
    var unlinkListenerA = jest.fn();
    var unlinkListenerB = jest.fn();

    watcher.watch();

    expect(watcherStub.on.mock.calls[0][0]).toBe('change');
    expect(watcherStub.on.mock.calls[1][0]).toBe('unlink');

    var triggerChange = watcherStub.on.mock.calls[0][1];
    var triggerUnlink = watcherStub.on.mock.calls[1][1];

    expect(typeof triggerChange).toBe('function');
    expect(typeof triggerUnlink).toBe('function');

    expect(function() {
      triggerChange('/test/test.ext1', {});
    }).not.toThrowError();
    expect(function() {
      triggerUnlink('/test/test.ext1', {});
    }).not.toThrowError();

    watcher.on('change', changeListenerA);
    watcher.on('change', changeListenerB);
    watcher.on('unlink', unlinkListenerA);
    watcher.on('unlink', unlinkListenerB);

    expect(watchStub).toHaveBeenCalled();
    expect(watchStub.mock.calls[0][0]).toBe('/test');
    expect(watchStub.mock.calls[1][0]).toBe('/bar');

    // manually trigger change listeners
    triggerChange('/test/test.txt', {});
    expect(changeListenerA).not.toHaveBeenCalled();
    expect(changeListenerB).not.toHaveBeenCalled();

    triggerChange('/test/test.ext1', {});
    expect(changeListenerB).toHaveBeenCalled();
    expect(changeListenerB).toHaveBeenCalled();

    // manually trigger unlink listeners
    triggerUnlink('/test/test.txt');
    expect(unlinkListenerA).not.toHaveBeenCalled();
    expect(unlinkListenerB).not.toHaveBeenCalled();

    triggerUnlink('/test/test.ext1');
    expect(unlinkListenerA).toHaveBeenCalled();
    expect(unlinkListenerB).toHaveBeenCalled();

    // check if off is working properly
    watcher.off('change', changeListenerA);
    watcher.off('unlink', unlinkListenerB);

    triggerChange('/test/test.ext1', {});
    triggerUnlink('/test/test.ext1');

    expect(changeListenerA).toHaveBeenCalledTimes(1);
    expect(changeListenerB).toHaveBeenCalledTimes(2);
    expect(unlinkListenerA).toHaveBeenCalledTimes(2);
    expect(unlinkListenerB).toHaveBeenCalledTimes(1);
  });
});
