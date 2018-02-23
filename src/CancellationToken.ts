import crypto = require('crypto');
import fs = require('fs');
import os = require('os');
import path = require('path');
import ts = require('typescript');

interface CancellationTokenData {
  isCancelled: boolean;
  cancellationFileName: string;
}

class CancellationToken {
  compiler: typeof ts;
  isCancelled: boolean;
  cancellationFileName: string;
  lastCancellationCheckTime: number;
  constructor(compiler: typeof ts, cancellationFileName: string, isCancelled: boolean) {
    this.compiler = compiler;
    this.isCancelled = !!isCancelled;
    this.cancellationFileName = cancellationFileName || crypto.randomBytes(64).toString('hex');
    this.lastCancellationCheckTime = 0;
  }

  static createFromJSON(compiler: typeof ts, json: CancellationTokenData) {
    return new CancellationToken(
      compiler,
      json.cancellationFileName,
      json.isCancelled
    );
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
      throw new this.compiler.OperationCanceledException();
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

export = CancellationToken;
