var ts = require('typescript');
var fs = require('fs');
var path = require('path');
var endsWith = require('lodash.endswith');
var FilesRegister = require('./FilesRegister');
var FilesWatcher = require('./FilesWatcher');
var WorkSet = require('./WorkSet');
var NormalizedMessage = require('./NormalizedMessage');

function IncrementalChecker (programConfigFile, linterConfigFile, watchPaths, workNumber, workDivision) {
  this.programConfigFile = programConfigFile;
  this.linterConfigFile = linterConfigFile;
  this.watchPaths = watchPaths;
  this.workNumber = workNumber || 0;
  this.workDivision = workDivision || 1;

  // it's shared between compilations
  this.files = new FilesRegister(function() {
    // data shape
    return {
      source: undefined,
      linted: false,
      lints: []
    };
  });
}
module.exports = IncrementalChecker;

IncrementalChecker.loadProgramConfig = function (configFile) {
  return ts.parseJsonConfigFileContent(
    // Regardless of the setting in the tsconfig.json we want isolatedModules to be false
    Object.assign(ts.readConfigFile(configFile, ts.sys.readFile).config, { isolatedModules: false }),
    ts.sys,
    path.dirname(configFile)
  );
};

IncrementalChecker.loadLinterConfig = function (configFile) {
  var tslint = require('tslint');

  return tslint.Configuration.loadConfigurationFromPath(configFile);
};

IncrementalChecker.createProgram = function (programConfig, files, watcher, oldProgram) {
  var host = ts.createCompilerHost(programConfig.options);
  var realGetSourceFile = host.getSourceFile;

  host.getSourceFile = function (filePath, languageVersion, onError) {
    // first check if watcher is watching file - if not - check it's mtime
    if (!watcher.isWatchingFile(filePath)) {
      try {
        var stats = fs.statSync(filePath);

        files.setMtime(filePath, stats.mtime.valueOf());
      } catch (e) {
        // probably file does not exists
        files.remove(filePath);
      }
    }

    // get source file only if there is no source in files register
    if (!files.has(filePath) || !files.getData(filePath).source) {
      files.mutateData(filePath, function (data) {
        data.source = realGetSourceFile(filePath, languageVersion, onError);
      });
    }

    return files.getData(filePath).source;
  };

  return ts.createProgram(
    programConfig.fileNames,
    programConfig.options,
    host,
    oldProgram // re-use old program
  );
};

IncrementalChecker.createLinter = function (program) {
  var tslint = require('tslint');

  return new tslint.Linter({ fix: false }, program);
};

IncrementalChecker.prototype.nextIteration = function () {
  if (!this.watcher) {
    this.watcher = new FilesWatcher(this.watchPaths, ['.ts', '.tsx']);

    // connect watcher with register
    this.watcher.on('change', function (filePath, stats) { this.files.setMtime(filePath, stats.mtime.valueOf()); }.bind(this));
    this.watcher.on('unlink', function (filePath) { this.files.remove(filePath); }.bind(this));

    this.watcher.watch();
  }

  if (!this.programConfig) {
    this.programConfig = IncrementalChecker.loadProgramConfig(this.programConfigFile);
  }

  if (!this.linterConfig && this.linterConfigFile) {
    this.linterConfig = IncrementalChecker.loadLinterConfig(this.linterConfigFile);
  }

  this.program = IncrementalChecker.createProgram(this.programConfig, this.files, this.watcher, this.program);
  if (this.linterConfig) {
    this.linter = IncrementalChecker.createLinter(this.program);
  }
};

IncrementalChecker.prototype.hasLinter = function () {
  return this.linter !== undefined;
};

IncrementalChecker.prototype.getDiagnostics = function (cancellationToken) {
  var diagnostics = [];
  // select files to check (it's semantic check - we have to include all files :/)
  var filesToCheck = this.program.getSourceFiles();

  // calculate subset of work to do
  var workSet = new WorkSet(filesToCheck, this.workNumber, this.workDivision);

  // check given work set
  workSet.forEach(function (sourceFile) {
    if (cancellationToken) {
      cancellationToken.throwIfCancellationRequested();
    }

    diagnostics.push.apply(diagnostics, this.program.getSemanticDiagnostics(sourceFile, cancellationToken));
  }.bind(this));

  // normalize and deduplicate diagnostics
  return NormalizedMessage.deduplicate(
    diagnostics.map(NormalizedMessage.createFromDiagnostic)
  );
};

IncrementalChecker.prototype.getLints = function (cancellationToken) {
  if (!this.hasLinter()) {
    throw new Error('Cannot get lints - checker has no linter.');
  }

  // select files to lint
  var filesToLint = this.files.keys().filter(function (filePath) {
    return !endsWith(filePath, '.d.ts') && !this.files.getData(filePath).linted;
  }.bind(this));

  // calculate subset of work to do
  var workSet = new WorkSet(filesToLint, this.workNumber, this.workDivision);

  // lint given work set
  workSet.forEach(function (fileName) {
    cancellationToken.throwIfCancellationRequested();

    try {
      this.linter.lint(fileName, undefined, this.linterConfig);
    } catch (e) {
      if (fs.existsSync(fileName)) {
        // it's not because file doesn't exist - throw error
        throw e;
      }
    }
  }.bind(this));

  // set lints in files register
  this.linter.getResult().failures.forEach(function (lint) {
    var filePath = lint.getFileName();

    this.files.mutateData(filePath, function (data) {
      data.linted = true;
      data.lints.push(lint);
    });
  }.bind(this));

  // set all files as linted
  this.files.keys().forEach(function (filePath) {
    this.files.mutateData(filePath, function (data) {
      data.linted = true;
    });
  }.bind(this));

  // get all lints
  var lints = this.files.keys().reduce(function (lints, filePath) {
    return lints.concat(this.files.getData(filePath).lints);
  }.bind(this), []);

  // normalize and deduplicate lints
  return NormalizedMessage.deduplicate(
    lints.map(NormalizedMessage.createFromLint)
  );
};
