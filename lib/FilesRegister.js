
function FilesRegister(oldRegister) {
  this.register = {};

  if (oldRegister) {
    oldRegister.forEach(function (fileName, fileEntry) {
      if (!fileEntry.modified) {
        // don't copy - just set reference to save memory
        this.register[fileName] = fileEntry;
      }
    }.bind(this));
  }
}
module.exports = FilesRegister;

FilesRegister.prototype.forEach = function (loop) {
  Object.keys(this.register).forEach(function (key) {
    loop(key, this.register[key]);
  }.bind(this));
};

FilesRegister.prototype.addFile = function (fileName) {
  this.register[fileName] = {
    modified: false,
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
    this.register[fileName].modified = true;
    this.register[fileName].linted = false;
    this.register[fileName].lints = [];
    this.register[fileName].mtime = mtime;
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
