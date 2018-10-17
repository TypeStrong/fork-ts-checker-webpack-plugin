import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ts from 'typescript';

interface CancellationTokenData {
  isCancelled: boolean;
  cancellationFileName: string;
}

export class CancellationToken {
  isCancelled: boolean;
  cancellationFileName: string;
  lastCancellationCheckTime: number;
  constructor(cancellationFileName: string, isCancelled: boolean) {
    this.isCancelled = !!isCancelled;
    this.cancellationFileName =
      cancellationFileName || crypto.randomBytes(64).toString('hex');
    this.lastCancellationCheckTime = 0;
  }

  static createFromJSON(json: CancellationTokenData) {
    return new CancellationToken(json.cancellationFileName, json.isCancelled);
  }

  toJSON() {
    return {
      cancellationFileName: this.cancellationFileName,
      isCancelled: this.isCancelled
    };
  }

  getCancellationFilePath() {
    return path.join(os.tmpdir(), this.cancellationFileName);
  }

  isCancellationRequested() {
    if (this.isCancelled) {
      return true;
    }

    const time = Date.now();
    const duration = Math.abs(time - this.lastCancellationCheckTime);

    if (duration > 10) {
      // check no more than once every 10ms
      this.lastCancellationCheckTime = time;
      this.isCancelled = fs.existsSync(this.getCancellationFilePath());
    }

    return this.isCancelled;
  }

  throwIfCancellationRequested() {
    if (this.isCancellationRequested()) {
      throw new ts.OperationCanceledException();
    }
  }

  requestCancellation() {
    fs.writeFileSync(this.getCancellationFilePath(), '');
    this.isCancelled = true;
  }

  cleanupCancellation() {
    if (this.isCancelled && fs.existsSync(this.getCancellationFilePath())) {
      fs.unlinkSync(this.getCancellationFilePath());
      this.isCancelled = false;
    }
  }
}
