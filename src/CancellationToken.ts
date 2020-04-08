import crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ts from 'typescript'; // Imported for types alone

import { fileExistsSync } from './FsHelper';

export interface CancellationTokenData {
  isCancelled: boolean;
  cancellationFileName: string;
}

export class CancellationToken {
  private isCancelled: boolean;
  private cancellationFileName: string;
  private lastCancellationCheckTime: number;
  constructor(
    private typescript: typeof ts,
    cancellationFileName?: string,
    isCancelled?: boolean
  ) {
    this.isCancelled = !!isCancelled;
    this.cancellationFileName =
      cancellationFileName || crypto.randomBytes(64).toString('hex');
    this.lastCancellationCheckTime = 0;
  }

  public static createFromJSON(
    typescript: typeof ts,
    json: CancellationTokenData
  ) {
    return new CancellationToken(
      typescript,
      json.cancellationFileName,
      json.isCancelled
    );
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
      // check no more than once every 10 ms
      this.lastCancellationCheckTime = time;
      this.isCancelled = fileExistsSync(this.getCancellationFilePath());
    }

    return this.isCancelled;
  }

  public throwIfCancellationRequested() {
    if (this.isCancellationRequested()) {
      throw new this.typescript.OperationCanceledException();
    }
  }

  public requestCancellation() {
    fs.writeFileSync(this.getCancellationFilePath(), '');
    this.isCancelled = true;
  }

  public cleanupCancellation() {
    if (this.isCancelled && fileExistsSync(this.getCancellationFilePath())) {
      fs.unlinkSync(this.getCancellationFilePath());
      this.isCancelled = false;
    }
  }
}
