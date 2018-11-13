import * as chokidar from 'chokidar';
import * as path from 'path';

export class FilesWatcher {
  watchPaths: string[];
  watchExtensions: string[];
  watchers: chokidar.FSWatcher[];
  listeners: { [eventName: string]: Function[] };
  constructor(watchPaths: string[], watchExtensions: string[]) {
    this.watchPaths = watchPaths;
    this.watchExtensions = watchExtensions;
    this.watchers = [];
    this.listeners = {};
  }

  isFileSupported(filePath: string) {
    return this.watchExtensions.indexOf(path.extname(filePath)) !== -1;
  }

  watch() {
    if (this.isWatching()) {
      throw new Error('Cannot watch again - already watching.');
    }

    this.watchers = this.watchPaths.map((watchPath: string) => {
      return chokidar
        .watch(watchPath, { persistent: true, alwaysStat: true })
        .on('change', (filePath: string, stats: any) => {
          if (this.isFileSupported(filePath)) {
            (this.listeners['change'] || []).forEach(changeListener => {
              changeListener(filePath, stats);
            });
          }
        })
        .on('unlink', (filePath: string) => {
          if (this.isFileSupported(filePath)) {
            (this.listeners['unlink'] || []).forEach(unlinkListener => {
              unlinkListener(filePath);
            });
          }
        });
    });
  }

  isWatchingFile(filePath: string) {
    return (
      this.isWatching() &&
      this.isFileSupported(filePath) &&
      this.watchPaths.some(watchPath => filePath.startsWith(watchPath))
    );
  }

  isWatching() {
    return this.watchers.length > 0;
  }

  on(event: string, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        oldListener => oldListener !== listener
      );
    }
  }
}
