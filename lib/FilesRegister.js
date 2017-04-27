
function FilesRegister () {
  this.register = {};
}
module.exports = FilesRegister;

FilesRegister.prototype.forEach = function (callback) {
  Object.keys(this.register).forEach(function (key) {
    callback(key, this.register[key]);
  }.bind(this));
};

FilesRegister.prototype.keys = function() {
  return Object.keys(this.register);
};

FilesRegister.prototype.addFile = function (fileName) {
  this.register[fileName] = {
    mtime: undefined,
    source: undefined,
    linted: false,
    lints: []
  };
};

FilesRegister.prototype.removeFile = function (fileName) {
  if (this.hasFile(fileName)) {
    delete this.register[fileName];
  }
};

FilesRegister.prototype.hasFile = function (fileName) {
  return this.register.hasOwnProperty(fileName);
};

FilesRegister.prototype.getFile = function (fileName) {
  if (!this.hasFile(fileName)) {
    throw new Error('File "' + fileName + '" not found in register.');
  }

  return this.register[fileName];
};

FilesRegister.prototype.ensureFile = function (fileName) {
  if (!this.hasFile(fileName)) {
    this.addFile(fileName);
  }
};

FilesRegister.prototype.setSource = function (fileName, source) {
  this.ensureFile(fileName);

  this.register[fileName].source = source;
};

FilesRegister.prototype.hasSource = function (fileName) {
  return this.hasFile(fileName) && !!this.getFile(fileName).source;
};

FilesRegister.prototype.getSource = function (fileName) {
  if (!this.hasSource(fileName)) {
    throw new Error('Cannot get source of "' + fileName + '" file.');
  }

  return this.getFile(fileName).source;
};

FilesRegister.prototype.setMtime = function (fileName, mtime) {
  this.ensureFile(fileName);

  if (this.register[fileName].mtime !== mtime) {
    this.register[fileName].linted = false;
    this.register[fileName].lints = [];
    this.register[fileName].mtime = mtime;

    // file has been changed - we are not sure about it's current source
    this.register[fileName].source = undefined;
  }
};

FilesRegister.prototype.getLints = function () {
  var lints = [];

  this.forEach(function (fileName, fileEntry) {
    lints.push.apply(lints, fileEntry.lints);
  });

  return lints;
};

FilesRegister.prototype.consumeLint = function (lint) {
  var fileName = lint.getFileName();

  this.ensureFile(fileName);

  this.register[fileName].linted = true;
  this.register[fileName].lints.push(lint);
};

FilesRegister.prototype.consumeLints = function (lints) {
  lints.forEach(function (lint) {
    this.consumeLint(lint);
  }.bind(this));
};

FilesRegister.prototype.setAllLinted = function () {
  this.keys().forEach(function (fileName) {
    this.register[fileName].linted = true;
  }.bind(this))
};
