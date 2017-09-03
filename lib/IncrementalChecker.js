"use strict";
var fs = require("fs");
var endsWith = require("lodash.endswith");
var path = require("path");
var ts = require("typescript");
var FilesRegister = require("./FilesRegister");
var FilesWatcher = require("./FilesWatcher");
var WorkSet = require("./WorkSet");
var NormalizedMessage = require("./NormalizedMessage");
var IncrementalChecker = /** @class */ (function () {
    function IncrementalChecker(programConfigFile, linterConfigFile, watchPaths, workNumber, workDivision, checkSyntacticErrors) {
        this.programConfigFile = programConfigFile;
        this.linterConfigFile = linterConfigFile;
        this.watchPaths = watchPaths;
        this.workNumber = workNumber || 0;
        this.workDivision = workDivision || 1;
        this.checkSyntacticErrors = checkSyntacticErrors || false;
        // it's shared between compilations
        this.files = new FilesRegister(function () { return ({
            // data shape
            source: undefined,
            linted: false,
            lints: []
        }); });
    }
    IncrementalChecker.loadProgramConfig = function (configFile) {
        return ts.parseJsonConfigFileContent(
        // Regardless of the setting in the tsconfig.json we want isolatedModules to be false
        Object.assign(ts.readConfigFile(configFile, ts.sys.readFile).config, { isolatedModules: false }), ts.sys, path.dirname(configFile));
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
                }
                catch (e) {
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
        return ts.createProgram(programConfig.fileNames, programConfig.options, host, oldProgram // re-use old program
        );
    };
    IncrementalChecker.createLinter = function (program) {
        var tslint = require('tslint');
        return new tslint.Linter({ fix: false }, program);
    };
    IncrementalChecker.prototype.nextIteration = function () {
        var _this = this;
        if (!this.watcher) {
            this.watcher = new FilesWatcher(this.watchPaths, ['.ts', '.tsx']);
            // connect watcher with register
            this.watcher.on('change', function (filePath, stats) {
                _this.files.setMtime(filePath, stats.mtime.valueOf());
            });
            this.watcher.on('unlink', function (filePath) {
                _this.files.remove(filePath);
            });
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
        var _this = this;
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
            var diagnosticsToRegister = _this.checkSyntacticErrors
                ? []
                    .concat(_this.program.getSemanticDiagnostics(sourceFile, cancellationToken))
                    .concat(_this.program.getSyntacticDiagnostics(sourceFile, cancellationToken))
                : _this.program.getSemanticDiagnostics(sourceFile, cancellationToken);
            diagnostics.push.apply(diagnostics, diagnosticsToRegister);
        });
        // normalize and deduplicate diagnostics
        return NormalizedMessage.deduplicate(diagnostics.map(NormalizedMessage.createFromDiagnostic));
    };
    IncrementalChecker.prototype.getLints = function (cancellationToken) {
        var _this = this;
        if (!this.hasLinter()) {
            throw new Error('Cannot get lints - checker has no linter.');
        }
        // select files to lint
        var filesToLint = this.files.keys().filter(function (filePath) {
            return !endsWith(filePath, '.d.ts') && !_this.files.getData(filePath).linted;
        });
        // calculate subset of work to do
        var workSet = new WorkSet(filesToLint, this.workNumber, this.workDivision);
        // lint given work set
        workSet.forEach(function (fileName) {
            cancellationToken.throwIfCancellationRequested();
            try {
                _this.linter.lint(fileName, undefined, _this.linterConfig);
            }
            catch (e) {
                if (fs.existsSync(fileName)) {
                    // it's not because file doesn't exist - throw error
                    throw e;
                }
            }
        });
        // set lints in files register
        this.linter.getResult().failures.forEach(function (lint) {
            var filePath = lint.getFileName();
            _this.files.mutateData(filePath, function (data) {
                data.linted = true;
                data.lints.push(lint);
            });
        });
        // set all files as linted
        this.files.keys().forEach(function (filePath) {
            _this.files.mutateData(filePath, function (data) {
                data.linted = true;
            });
        });
        // get all lints
        var lints = this.files.keys().reduce(function (innerLints, filePath) {
            return innerLints.concat(_this.files.getData(filePath).lints);
        }, []);
        // normalize and deduplicate lints
        return NormalizedMessage.deduplicate(lints.map(NormalizedMessage.createFromLint));
    };
    return IncrementalChecker;
}());
module.exports = IncrementalChecker;
