import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ts from 'typescript';

import { FsHelper } from './FsHelper';

interface CancellationTokenData {
  isCancelled: boolean;
  cancellationFileName: string;
}

export class CancellationToken {
  private isCancelled: boolean;
  private cancellationFileName: string;
  private lastCancellationCheckTime: number;
  constructor(cancellationFileName?: string, isCancelled?: boolean) {
    this.isCancelled = !!isCancelled;
    this.cancellationFileName =
      cancellationFileName || crypto.randomBytes(64).toString('hex');
    this.lastCancellationCheckTime = 0;
  }

  public static createFromJSON(json: CancellationTokenData) {
    return new CancellationToken(json.cancellationFileName, json.isCancelled);
  }

  public toJSON() {
    return {
      cancellationFileName: this.cancellationFileName,
      isCancelled: this.isCancelled
    };
  }

  public getCancellationFilePath() {
    return path.join(os.tmpdir(), this.cancellationFileName);
  }

  public isCancellationRequested() {
    if (this.isCancelled) {
      return true;
    }

    const time = Date.now();
    const duration = Math.abs(time - this.lastCancellationCheckTime);

    if (duration > 10) {
      // check no more than once every 10ms
      this.lastCancellationCheckTime = time;
      this.isCancelled = FsHelper.existsSync(this.getCancellationFilePath());
    }

    return this.isCancelled;
  }

  public throwIfCancellationRequested() {
    if (this.isCancellationRequested()) {
      throw new ts.OperationCanceledException();
    }
  }

  public requestCancellation() {
    fs.writeFileSync(this.getCancellationFilePath(), '');
    this.isCancelled = true;
  }

  public cleanupCancellation() {
    if (
      this.isCancelled &&
      FsHelper.existsSync(this.getCancellationFilePath())
    ) {
      fs.unlinkSync(this.getCancellationFilePath());
      this.isCancelled = false;
    }
  }
}
