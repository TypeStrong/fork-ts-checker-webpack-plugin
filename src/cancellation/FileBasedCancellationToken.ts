import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { CancellationToken } from './CancellationToken';

interface FileBasedCancellationTokenJSON {
  readonly cancellationFilePath: string;
  readonly isCancelled: boolean;
}

class FileBasedCancellationToken implements CancellationToken {
  private readonly cancellationFilePath: string;
  private isCancelled: boolean;
  private lastCancellationCheckTime: number;

  constructor(
    cancellationFilePath = path.join(
      os.tmpdir(),
      crypto.randomBytes(20).toString('hex')
    ),
    isCancelled = false
  ) {
    this.cancellationFilePath = cancellationFilePath;
    this.isCancelled = isCancelled;
    this.lastCancellationCheckTime = 0;
  }

  static createFromJSON(json: FileBasedCancellationTokenJSON) {
    return new FileBasedCancellationToken(
      json.cancellationFilePath,
      json.isCancelled
    );
  }

  toJSON(): FileBasedCancellationTokenJSON {
    return {
      cancellationFilePath: this.cancellationFilePath,
      isCancelled: this.isCancelled
    };
  }

  isCancellationRequested() {
    if (this.isCancelled) {
      return true;
    }

    const time = Date.now();
    const duration = Math.abs(time - this.lastCancellationCheckTime);

    if (duration > 20) {
      // check no more than once every 20ms
      this.lastCancellationCheckTime = time;
      this.isCancelled = fs.existsSync(this.cancellationFilePath);
    }

    return this.isCancelled;
  }

  requestCancellation() {
    fs.writeFileSync(this.cancellationFilePath, '');
    this.isCancelled = true;
  }

  cleanupCancellation() {
    if (this.isCancelled && fs.existsSync(this.cancellationFilePath)) {
      try {
        fs.unlinkSync(this.cancellationFilePath);
      } catch (error) {
        // fail silently as the file is in the tmp directory
      }
      this.isCancelled = false;
    }
  }
}

export { FileBasedCancellationToken, FileBasedCancellationTokenJSON };
