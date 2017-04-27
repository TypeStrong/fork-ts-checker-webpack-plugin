var ts = require('typescript');
var fs = require('fs');
var path = require('path');
var endsWith = require('lodash.endswith');
var FilesRegister = require('./FilesRegister');
var FilesWatcher = require('./FilesWatcher');
var WorkSplitter = require('./WorkSplitter');

function IncrementalChecker (programConfigFile, linterConfigFile, watchPaths, workNumber, workDivision) {
  this.programConfigFile = programConfigFile;
  this.linterConfigFile = linterConfigFile;
  this.watchPaths = watchPaths;
  this.workNumber = workNumber || 0;
  this.workDivision = workDivision || 1;

  // it's shared between compilations
  this.register = new FilesRegister();
}
module.exports = IncrementalChecker;

IncrementalChecker.loadProgramConfig = function (configFile) {
  return ts.parseJsonConfigFileContent(
    ts.readConfigFile(configFile, ts.sys.readFile).config,
    ts.sys,
    path.dirname(configFile)
  );
};

IncrementalChecker.loadLinterConfig = function (configFile) {
  var tslint = require('tslint');

  return tslint.Configuration.loadConfigurationFromPath(configFile);
};

IncrementalChecker.createProgram = function (programConfig, register, watcher, oldProgram) {
  var host = ts.createCompilerHost(programConfig.options);
  var originGetSourceFile = host.getSourceFile;

  host.getSourceFile = function (filePath, languageVersion, onError) {
    // first check if watcher is watching file - if not - check it's mtime
    if (!watcher.isWatchingFile(filePath)) {
      var stats = fs.statSync(filePath);

      register.setMtime(filePath, stats.mtime.valueOf());
    }

    // get source file only if there is no source in files register
    if (!register.hasSource(filePath)) {
      register.setSource(
        filePath,
        originGetSourceFile(filePath, languageVersion, onError)
      );
    }

    return register.getSource(filePath);
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
    this.watcher.onChange(function (filePath, stats) { this.register.setMtime(filePath, stats.mtime.valueOf()); }.bind(this));
    this.watcher.onUnlink(function (filePath) { this.register.removeFile(filePath); }.bind(this));

    this.watcher.watch();
  }

  if (!this.programConfig) {
    this.programConfig = IncrementalChecker.loadProgramConfig(this.programConfigFile);
  }

  if (!this.linterConfig && this.linterConfigFile) {
    this.linterConfig = IncrementalChecker.loadLinterConfig(this.linterConfigFile);
  }

  this.program = IncrementalChecker.createProgram(this.programConfig, this.register, this.watcher, this.program);
  this.linter = IncrementalChecker.createLinter(this.program);
};

IncrementalChecker.prototype.getDiagnostics = function (cancellationToken) {
  var diagnostics = [];
  var times = [];
  var filesToCheck = this.program.getSourceFiles();
  var work = new WorkSplitter(filesToCheck, this.workNumber, this.workDivision);

  work.forEach(function (sourceFile, i) {
    times[i] = process.hrtime();
    if (cancellationToken) {
      cancellationToken.throwIfCancellationRequested();
    }

    ts.addRange(diagnostics, this.program.getSemanticDiagnostics(sourceFile, cancellationToken));
    times[i] = process.hrtime(times[i]);
  }.bind(this));

  var elapsed = times.map(function (time) {
    return Math.round(Math.round(time[0] * 1E9 + time[1]) / 1E6); // in ms
  });
  elapsed.sort(function (a, b) { return b - a; });

  diagnostics = ts.sortAndDeduplicateDiagnostics(diagnostics);

  return diagnostics.map(function (diagnostic) {
    var position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);

    // normalize diagnostics
    return {
      type: 'typescript',
      code: diagnostic.code,
      category: ts.DiagnosticCategory[diagnostic.category].toLowerCase(),
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      file: diagnostic.file.fileName,
      line: position.line,
      character: position.character
    };
  });
};

IncrementalChecker.prototype.getLints = function (cancellationToken) {
  var filesToLint = this.register.keys().filter(function (fileName) {
    return !endsWith(fileName, '.d.ts') && !this.register.getFile(fileName).linted;
  }.bind(this));

  var work = new WorkSplitter(filesToLint, this.workNumber, this.workDivision);

  work.forEach(function (fileName) {
    cancellationToken.throwIfCancellationRequested();

    this.linter.lint(fileName, undefined, this.linterConfig);
  }.bind(this));

  this.register.setAllLinted();
  this.register.consumeLints(this.linter.getResult().failures);

  var lints = this.register.getLints();

  return lints.map(function (lint) {
    var position = lint.getStartPosition().getLineAndCharacter();

    // normalize lints
    return {
      type: 'tslint',
      code: lint.getRuleName(),
      category: lint.getRuleSeverity(),
      message: lint.getFailure(),
      file: lint.getFileName(),
      line: position.line,
      character: position.character
    };
  });
};
