
function WorkSplitter (workSet, workNumber, workDivision) {
  this.workSet = workSet;
  this.workNumber = workNumber;
  this.workDivision = workDivision;
  this.workSize = Math.floor(this.workSet.length / this.workDivision);
  this.workBegin = this.workNumber * this.workSize;
  this.workEnd = this.workBegin + this.workSize;

  // be sure that we will process all work for odd workSize.
  if (this.workNumber === this.workSet.length - 1) {
    this.workEnd = this.workSet.length;
  }
}
module.exports = WorkSplitter;

WorkSplitter.prototype.forEach = function (callback) {
  for (var i = this.workBegin; i < this.workEnd; ++i) {
    callback(this.workSet[i], i);
  }
};

WorkSplitter.prototype.getWorkSize = function () {
  return this.workSize;
};

WorkSplitter.prototype.getWorkBegin = function () {
  return this.workBegin;
};

WorkSplitter.prototype.getWorkEnd = function () {
  return this.workEnd;
};