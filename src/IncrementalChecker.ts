import fs = require('fs');
import endsWith = require('lodash.endswith');
import path = require('path');
import ts = require('typescript');
import tslintTypes = require('tslint'); // Imported for types alone; actual requires take place in methods below
import FilesRegister = require('./FilesRegister');
import FilesWatcher = require('./FilesWatcher');
import WorkSet = require('./WorkSet');
import NormalizedMessage = require('./NormalizedMessage');

class IncrementalChecker {
  programConfigFile: string;
  linterConfigFile: string;
  watchPaths: string[];
  workNumber: number;
  workDivision: number;
  checkSyntacticErrors: boolean;
  files: FilesRegister;

  linter: tslintTypes.Linter;
  linterConfig: tslintTypes.Configuration.IConfigurationFile;

  program: ts.Program;
  programConfig: ts.ParsedCommandLine;
  watcher: FilesWatcher;

  constructor(programConfigFile, linterConfigFile, watchPaths, workNumber, workDivision, checkSyntacticErrors) {
    this.programConfigFile = programConfigFile;
    this.linterConfigFile = linterConfigFile;
    this.watchPaths = watchPaths;
    this.workNumber = workNumber || 0;
    this.workDivision = workDivision || 1;
    this.checkSyntacticErrors = checkSyntacticErrors || false;

    // it's shared between compilations
    this.files = new FilesRegister(() => ({
        // data shape
        source: undefined,
        linted: false,
        lints: []
    }));
  }

  static loadProgramConfig(configFile: string) {
    return ts.parseJsonConfigFileContent(
      // Regardless of the setting in the tsconfig.json we want isolatedModules to be false
      Object.assign(ts.readConfigFile(configFile, ts.sys.readFile).config, { isolatedModules: false }),
      ts.sys,
      path.dirname(configFile)
    );
  }

  static loadLinterConfig(configFile: string) {
    const tslint: typeof tslintTypes = require('tslint');

    return tslint.Configuration.loadConfigurationFromPath(configFile);
  }

  static createProgram(programConfig, files, watcher, oldProgram) {
    const host = ts.createCompilerHost(programConfig.options);
    const realGetSourceFile = host.getSourceFile;

    host.getSourceFile = (filePath, languageVersion, onError) => {
      // first check if watcher is watching file - if not - check it's mtime
      if (!watcher.isWatchingFile(filePath)) {
        try {
          const stats = fs.statSync(filePath);

          files.setMtime(filePath, stats.mtime.valueOf());
        } catch (e) {
          // probably file does not exists
          files.remove(filePath);
        }
      }

      // get source file only if there is no source in files register
      if (!files.has(filePath) || !files.getData(filePath).source) {
        files.mutateData(filePath, (data) => {
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
  }

  static createLinter(program) {
    const tslint: typeof tslintTypes = require('tslint');

    return new tslint.Linter({ fix: false }, program);
  }

  nextIteration() {
    if (!this.watcher) {
      this.watcher = new FilesWatcher(this.watchPaths, ['.ts', '.tsx']);

      // connect watcher with register
      this.watcher.on('change', (filePath: string, stats) => {
        this.files.setMtime(filePath, stats.mtime.valueOf());
      });
      this.watcher.on('unlink', (filePath: string) => {
        this.files.remove(filePath);
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
  }

  hasLinter() {
    return this.linter !== undefined;
  }

  getDiagnostics(cancellationToken) {
    const diagnostics = [];
    // select files to check (it's semantic check - we have to include all files :/)
    const filesToCheck = this.program.getSourceFiles();

    // calculate subset of work to do
    const workSet = new WorkSet(filesToCheck, this.workNumber, this.workDivision);

    // check given work set
    workSet.forEach(sourceFile => {
      if (cancellationToken) {
        cancellationToken.throwIfCancellationRequested();
      }

      const diagnosticsToRegister = this.checkSyntacticErrors
        ? []
          .concat(this.program.getSemanticDiagnostics(sourceFile, cancellationToken))
          .concat(this.program.getSyntacticDiagnostics(sourceFile, cancellationToken))
        : this.program.getSemanticDiagnostics(sourceFile, cancellationToken);

      diagnostics.push.apply(diagnostics, diagnosticsToRegister);
    });

    // normalize and deduplicate diagnostics
    return NormalizedMessage.deduplicate(
      diagnostics.map(NormalizedMessage.createFromDiagnostic)
    );
  }

  getLints(cancellationToken) {
    if (!this.hasLinter()) {
      throw new Error('Cannot get lints - checker has no linter.');
    }

    // select files to lint
    const filesToLint = this.files.keys().filter(filePath =>
      !endsWith(filePath, '.d.ts') && !this.files.getData(filePath).linted
    );

    // calculate subset of work to do
    const workSet = new WorkSet(filesToLint, this.workNumber, this.workDivision);

    // lint given work set
    workSet.forEach(fileName => {
      cancellationToken.throwIfCancellationRequested();

      try {
        this.linter.lint(fileName, undefined, this.linterConfig);
      } catch (e) {
        if (fs.existsSync(fileName)) {
          // it's not because file doesn't exist - throw error
          throw e;
        }
      }
    });

    // set lints in files register
    this.linter.getResult().failures.forEach(lint => {
      const filePath = lint.getFileName();

      this.files.mutateData(filePath, data => {
        data.linted = true;
        data.lints.push(lint);
      });
    });

    // set all files as linted
    this.files.keys().forEach(filePath => {
      this.files.mutateData(filePath, data => {
        data.linted = true;
      });
    });

    // get all lints
    const lints = this.files.keys().reduce((innerLints, filePath) =>
      innerLints.concat(this.files.getData(filePath).lints),
      []);

    // normalize and deduplicate lints
    return NormalizedMessage.deduplicate(
      lints.map(NormalizedMessage.createFromLint)
    );
  }
}

export = IncrementalChecker;
