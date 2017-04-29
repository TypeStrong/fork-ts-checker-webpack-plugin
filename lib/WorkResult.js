function WorkResult(workDomain) {
  this.workResult = {};
  this.workDomain = workDomain;
}
module.exports = WorkResult;

WorkResult.prototype.supports = function (workName) {
  return -1 !== this.workDomain.indexOf(workName);
};

WorkResult.prototype.set = function (workName, result) {
  if (!this.supports(workName)) {
    throw new Error('Cannot set result - work "' + workName + '" is not supported.');
  }

  this.workResult[workName] = result;
};

WorkResult.prototype.has = function (workName) {
  return this.supports(workName) && undefined !== this.workResult[workName];
};

WorkResult.prototype.get = function (workName) {
  if (!this.supports(workName)) {
    throw new Error('Cannot get result - work "' + workName + '" is not supported.');
  }

  return this.workResult[workName];
};

WorkResult.prototype.hasAll = function () {
  return this.workDomain.every(function (key) {
    return this.has(key);
  }.bind(this));
};

WorkResult.prototype.clear = function () {
  this.workResult = {};
};

WorkResult.prototype.reduce = function (reducer, initial) {
  return this.workDomain.reduce(function (reduced, workName) {
    return reducer(reduced, this.workResult[workName]);
  }.bind(this), initial);
};
