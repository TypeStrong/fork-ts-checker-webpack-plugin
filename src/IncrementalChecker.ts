import fs = require('fs');
import endsWith = require('lodash.endswith');
import path = require('path');
import ts = require('typescript');
import tslintTypes = require('tslint'); // Imported for types alone; actual requires take place in methods below
import FilesRegister = require('./FilesRegister');
import FilesWatcher = require('./FilesWatcher');
import WorkSet = require('./WorkSet');
import NormalizedMessage = require('./NormalizedMessage');
import CancellationToken = require('./CancellationToken');
import minimatch = require('minimatch');

// Need some augmentation here - linterOptions.exclude is not (yet) part of the official
// types for tslint.
interface ConfigurationFile extends tslintTypes.Configuration.IConfigurationFile {
  linterOptions?: {
    typeCheck?: boolean;
    exclude?: string[];
  };
}

class IncrementalChecker {
  programConfigFile: string;
  linterConfigFile: string | false;
  watchPaths: string[];
  workNumber: number;
  workDivision: number;
  checkSyntacticErrors: boolean;
  files: FilesRegister;

  linter: tslintTypes.Linter;
  linterConfig: ConfigurationFile;
  linterExclusions: minimatch.IMinimatch[];

  program: ts.Program;
  programConfig: ts.ParsedCommandLine;
  watcher: FilesWatcher;

  constructor(
    programConfigFile: string,
    linterConfigFile: string | false,
    watchPaths: string[],
    workNumber: number,
    workDivision: number,
    checkSyntacticErrors: boolean
  ) {
    this.programConfigFile = programConfigFile;
    this.linterConfigFile = linterConfigFile;
    this.watchPaths = watchPaths;
    this.workNumber = workNumber || 0;
    this.workDivision = workDivision || 1;
    this.checkSyntacticErrors = checkSyntacticErrors || false;
    // Use empty array of exclusions in general to avoid having
    // to check of its existence later on.
    this.linterExclusions = [];

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

  static loadLinterConfig(configFile: string): ConfigurationFile {
    const tslint: typeof tslintTypes = require('tslint');

    return tslint.Configuration.loadConfigurationFromPath(configFile) as ConfigurationFile;
  }

  static createProgram(
    programConfig: ts.ParsedCommandLine,
    files: FilesRegister,
    watcher: FilesWatcher,
    oldProgram: ts.Program
  ) {
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

  static createLinter(program: ts.Program) {
    const tslint: typeof tslintTypes = require('tslint');

    return new tslint.Linter({ fix: false }, program);
  }

  static isFileExcluded(filePath: string, linterExclusions: minimatch.IMinimatch[]): boolean {
    return endsWith(filePath, '.d.ts') || linterExclusions.some(matcher => matcher.match(filePath));
  }

  nextIteration() {
    if (!this.watcher) {
      this.watcher = new FilesWatcher(this.watchPaths, ['.ts', '.tsx']);

      // connect watcher with register
      this.watcher.on('change', (filePath: string, stats: fs.Stats) => {
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

      if (this.linterConfig.linterOptions && this.linterConfig.linterOptions.exclude) {
        // Pre-build minimatch patterns to avoid additional overhead later on.
        // Note: Resolving the path is required to properly match against the full file paths,
        // and also deals with potential cross-platform problems regarding path separators.
        this.linterExclusions = this.linterConfig.linterOptions.exclude.map(pattern => new minimatch.Minimatch(path.resolve(pattern)));
      }
    }

    this.program = IncrementalChecker.createProgram(this.programConfig, this.files, this.watcher, this.program);
    if (this.linterConfig) {
      this.linter = IncrementalChecker.createLinter(this.program);
    }
  }

  hasLinter() {
    return this.linter !== undefined;
  }

  getDiagnostics(cancellationToken: CancellationToken) {
    const diagnostics: ts.Diagnostic[] = [];
    // select files to check (it's semantic check - we have to include all files :/)
    const filesToCheck = this.program.getSourceFiles();

    // calculate subset of work to do
    const workSet = new WorkSet(filesToCheck, this.workNumber, this.workDivision);

    // check given work set
    workSet.forEach(sourceFile => {
      if (cancellationToken) {
        cancellationToken.throwIfCancellationRequested();
      }

      const diagnosticsToRegister: ReadonlyArray<ts.Diagnostic> = this.checkSyntacticErrors
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

  getLints(cancellationToken: CancellationToken) {
    if (!this.hasLinter()) {
      throw new Error('Cannot get lints - checker has no linter.');
    }

    // select files to lint
    const filesToLint = this.files.keys().filter(filePath =>
      !this.files.getData(filePath).linted && !IncrementalChecker.isFileExcluded(filePath, this.linterExclusions)
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
