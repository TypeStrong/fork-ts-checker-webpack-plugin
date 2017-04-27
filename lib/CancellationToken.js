var ts = require('typescript');
var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');

function CancellationToken (cancellationFileName, isCancelled) {
  this.isCancelled = !!isCancelled;
  this.cancellationFileName = cancellationFileName || crypto.randomBytes(64).toString('hex');
  this.lastCancellationCheckTime = 0;
}
module.exports = CancellationToken;

CancellationToken.createFromJSON = function (json) {
  return new CancellationToken(
    json.cancellationFileName,
    json.isCancelled
  );
};

CancellationToken.prototype.toJSON = function () {
  return {
    cancellationFileName: this.cancellationFileName,
    isCancelled: this.isCancelled
  };
};

CancellationToken.prototype.isCancellationRequested = function () {
  if (this.isCancelled) {
    return true;
  }

  var time = Date.now();
  var duration = Math.abs(time - this.lastCancellationCheckTime);

  if (duration > 10) {
    // check no more than once every 10ms
    this.lastCancellationCheckTime = time;
    this.isCancelled = fs.existsSync(getCancellationFilePath(this.cancellationFileName));
  }

  return this.isCancelled;
};

CancellationToken.prototype.throwIfCancellationRequested = function () {
  if (this.isCancellationRequested()) {
    throw new ts.OperationCanceledException();
  }
};

CancellationToken.prototype.requestCancellation = function () {
  fs.writeFileSync(getCancellationFilePath(this.cancellationFileName), '');
};

CancellationToken.prototype.cleanupCancellation = function () {
  if (this.isCancelled) {
    fs.unlink(getCancellationFilePath(this.cancellationFileName));
  }
};

function getCancellationFilePath (cancellationFileName) {
  return path.join(os.tmpdir(), cancellationFileName);
}
