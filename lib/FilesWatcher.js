var chokidar = require('chokidar');
var path = require('path');
var startsWith = require('lodash.startswith');

function FilesWatcher(watchPaths, watchExtensions) {
  this.watchPaths = watchPaths;
  this.watchExtensions = watchExtensions;
  this.watchers = [];
  this.changeListeners = [];
  this.unlinkListeners = [];
}
module.exports = FilesWatcher;

FilesWatcher.prototype.isFileSupported = function(filePath) {
  return -1 !== this.watchExtensions.indexOf(path.extname(filePath));
};

FilesWatcher.prototype.watch = function () {
  this.watchers = this.watchPaths.map(function (watchPath) {
    return chokidar.watch(
      watchPath,
      { persistent: true }
    )
    .on('change', function(filePath, stats) {
      if (this.isFileSupported(filePath)) {
        this.changeListeners.forEach(function (changeListener) {
          changeListener(filePath, stats);
        });
      }
    }.bind(this))
    .on('unlink', function(filePath) {
      if (this.isFileSupported(filePath)) {
        this.unlinkListeners.forEach(function (unlinkListener) {
          unlinkListener(filePath);
        });
      }
    }.bind(this));
  }.bind(this));
};

FilesWatcher.prototype.isWatchingFile = function (filePath) {
  return (
    this.isWatching() &&
    this.watchPaths.some(function (watchPath) {
      return startsWith(filePath, watchPath);
    })
  );
};

FilesWatcher.prototype.isWatching = function () {
  return this.watchers.length > 0;
};

FilesWatcher.prototype.onChange = function (changeListener) {
  this.changeListeners.push(changeListener);

  return function unsubscribe() {
    this.changeListeners.filter(function (listener) {
      return listener !== changeListener;
    })
  }.bind(this);
};

FilesWatcher.prototype.onUnlink = function (unlinkListener) {
  this.unlinkListeners.push(unlinkListener);

  return function unsubscribe() {
    this.unlinkListeners.filter(function (listener) {
      return listener !== unlinkListener;
    })
  }.bind(this);
};
