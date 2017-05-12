var chokidar = require('chokidar');
var path = require('path');
var startsWith = require('lodash.startswith');

function FilesWatcher (watchPaths, watchExtensions) {
  this.watchPaths = watchPaths;
  this.watchExtensions = watchExtensions;
  this.watchers = [];
  this.listeners = {};
}
module.exports = FilesWatcher;

FilesWatcher.prototype.isFileSupported = function (filePath) {
  return this.watchExtensions.indexOf(path.extname(filePath)) !== -1;
};

FilesWatcher.prototype.watch = function () {
  if (this.isWatching()) {
    throw new Error('Cannot watch again - already watching.');
  }

  this.watchers = this.watchPaths.map(function (watchPath) {
    return chokidar.watch(
      watchPath,
      { persistent: true, alwaysStat: true }
    )
    .on('change', function (filePath, stats) {
      if (this.isFileSupported(filePath)) {
        (this.listeners['change'] || []).forEach(function (changeListener) {
          changeListener(filePath, stats);
        });
      }
    }.bind(this))
    .on('unlink', function (filePath) {
      if (this.isFileSupported(filePath)) {
        (this.listeners['unlink'] || []).forEach(function (unlinkListener) {
          unlinkListener(filePath);
        });
      }
    }.bind(this));
  }.bind(this));
};

FilesWatcher.prototype.isWatchingFile = function (filePath) {
  return (
    this.isWatching() &&
    this.isFileSupported(filePath) &&
    this.watchPaths.some(function (watchPath) {
      return startsWith(filePath, watchPath);
    })
  );
};

FilesWatcher.prototype.isWatching = function () {
  return this.watchers.length > 0;
};

FilesWatcher.prototype.on = function (event, listener) {
  if (!this.listeners[event]) {
    this.listeners[event] = [];
  }

  this.listeners[event].push(listener);
};

FilesWatcher.prototype.off = function (event, listener) {
  if (this.listeners[event]) {
    this.listeners[event] = this.listeners[event].filter(function (oldListener) {
      return oldListener !== listener;
    });
  }
};
