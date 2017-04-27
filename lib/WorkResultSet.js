var ts = require('typescript');

function WorkResultSet() {
  this.result = {};
}
module.exports = WorkResultSet;

WorkResultSet.prototype.set = function (key, result) {
  this.result[key] = result;
};

WorkResultSet.prototype.has = function (key) {
  return undefined !== this.result[key];
};

WorkResultSet.prototype.clear = function () {
  this.result = {};
};

WorkResultSet.prototype.done = function (keys) {
  return keys.every(function (key) {
    return this.has(key)
  }.bind(this));
};

WorkResultSet.prototype.merge = function () {
  var merged = {
    diagnostics: [],
    lints: []
  };

  Object.keys(this.result).forEach(function (key) {
    merged.diagnostics.push.apply(merged.diagnostics, this.result[key].diagnostics);
    merged.lints.push.apply(merged.lints, this.result[key].lints);
  }.bind(this));

  merged.diagnostics = ts.sortAndDeduplicateDiagnostics(merged.diagnostics);

  return merged;
};
