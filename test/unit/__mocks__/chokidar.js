/* global module */
const { EventEmitter } = require('events');

class FSWatcher extends EventEmitter {
  constructor() {
    super();
    this.watched = new Set();
  }

  add(paths) {
    if (Array.isArray(paths)) {
      paths.forEach((p) => this.watched.add(p));
    } else {
      this.watched.add(paths);
    }
    return this;
  }

  unwatch(paths) {
    if (Array.isArray(paths)) {
      paths.forEach((p) => this.watched.delete(p));
    } else {
      this.watched.delete(paths);
    }
    return this;
  }

  close() {
    this.watched.clear();
    return Promise.resolve();
  }

  getWatched() {
    return Array.from(this.watched);
  }
}

module.exports = {
  watch: () => new FSWatcher(),
};
