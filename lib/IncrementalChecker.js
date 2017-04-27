var ts = require('typescript');
var fs = require('fs');
var path = require('path');
var endsWith = require('lodash.endswith');
var FilesRegister = require('./FilesRegister');
var FilesWatcher = require('./FilesWatcher');

function IncrementalChecker (programConfigFile, linterConfigFile, watchPaths) {
  this.programConfigFile = programConfigFile;
  this.linterConfigFile = linterConfigFile;
  this.watchPaths = watchPaths;
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

      register.setMtime(filePath, stats.mtime);
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
  this.register = new FilesRegister(this.register);

  if (!this.watcher) {
    this.watcher = new FilesWatcher(this.watchPaths, ['.ts', '.tsx']);

    // connect watcher with register
    this.watcher.onChange(function (filePath, stats) { this.register.setMtime(filePath, stats.mtime); }.bind(this));
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
  var diagnostics = this.program.getSemanticDiagnostics(undefined, cancellationToken);

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
  this.register.forEach(function (fileName, fileEntry) {
    cancellationToken.throwIfCancellationRequested();

    if (!endsWith(fileName, '.d.ts') && !fileEntry.linted) {
      this.linter.lint(fileName, undefined, this.linterConfig);
      fileEntry.linted = true;
    }
  }.bind(this));

  this.register.consumeLints(
    this.linter.getResult().failures
  );

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
