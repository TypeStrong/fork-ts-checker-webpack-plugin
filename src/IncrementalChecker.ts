import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { Configuration, Linter, RuleFailure } from 'tslint'; // Imported for types alone; actual requires take place in methods below
import { FilesRegister } from './FilesRegister';
import { FilesWatcher } from './FilesWatcher';
import { WorkSet } from './WorkSet';
import { NormalizedMessage } from './NormalizedMessage';
import { CancellationToken } from './CancellationToken';
import * as minimatch from 'minimatch';
import { VueProgram } from './VueProgram';
import { FsHelper } from './FsHelper';

// Need some augmentation here - linterOptions.exclude is not (yet) part of the official
// types for tslint.
interface ConfigurationFile extends Configuration.IConfigurationFile {
  linterOptions?: {
    typeCheck?: boolean;
    exclude?: string[];
  };
}

export class IncrementalChecker {
  // it's shared between compilations
  private files = new FilesRegister(() => ({
    // data shape
    source: undefined,
    linted: false,
    lints: []
  }));

  private linter?: Linter;
  private linterConfig?: ConfigurationFile;

  // Use empty array of exclusions in general to avoid having
  // to check of its existence later on.
  private linterExclusions: minimatch.IMinimatch[] = [];

  private program?: ts.Program;
  private programConfig?: ts.ParsedCommandLine;
  private watcher?: FilesWatcher;

  constructor(
    private programConfigFile: string,
    private compilerOptions: object,
    private linterConfigFile: string | false,
    private linterAutoFix: boolean,
    private watchPaths: string[],
    private workNumber: number = 0,
    private workDivision: number = 1,
    private checkSyntacticErrors: boolean = false,
    private vue: boolean = false
  ) {}

  public static loadProgramConfig(configFile: string, compilerOptions: object) {
    const tsconfig = ts.readConfigFile(configFile, ts.sys.readFile).config;

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions = {
      ...tsconfig.compilerOptions,
      ...compilerOptions
    };

    const parsed = ts.parseJsonConfigFileContent(
      tsconfig,
      ts.sys,
      path.dirname(configFile)
    );

    return parsed;
  }

  private static loadLinterConfig(configFile: string): ConfigurationFile {
    const tslint = require('tslint');

    return tslint.Configuration.loadConfigurationFromPath(
      configFile
    ) as ConfigurationFile;
  }

  private static createProgram(
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
        files.mutateData(filePath, data => {
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

  private createLinter(program: ts.Program) {
    const tslint = require('tslint');

    return new tslint.Linter({ fix: this.linterAutoFix }, program);
  }

  public hasLinter(): boolean {
    return !!this.linter;
  }

  public static isFileExcluded(
    filePath: string,
    linterExclusions: minimatch.IMinimatch[]
  ): boolean {
    return (
      filePath.endsWith('.d.ts') ||
      linterExclusions.some(matcher => matcher.match(filePath))
    );
  }

  public nextIteration() {
    if (!this.watcher) {
      const watchExtensions = this.vue
        ? ['.ts', '.tsx', '.vue']
        : ['.ts', '.tsx'];
      this.watcher = new FilesWatcher(this.watchPaths, watchExtensions);

      // connect watcher with register
      this.watcher.on('change', (filePath: string, stats: fs.Stats) => {
        this.files.setMtime(filePath, stats.mtime.valueOf());
      });
      this.watcher.on('unlink', (filePath: string) => {
        this.files.remove(filePath);
      });

      this.watcher.watch();
    }

    if (!this.linterConfig && this.linterConfigFile) {
      this.linterConfig = IncrementalChecker.loadLinterConfig(
        this.linterConfigFile
      );

      if (
        this.linterConfig.linterOptions &&
        this.linterConfig.linterOptions.exclude
      ) {
        // Pre-build minimatch patterns to avoid additional overhead later on.
        // Note: Resolving the path is required to properly match against the full file paths,
        // and also deals with potential cross-platform problems regarding path separators.
        this.linterExclusions = this.linterConfig.linterOptions.exclude.map(
          pattern => new minimatch.Minimatch(path.resolve(pattern))
        );
      }
    }

    this.program = this.vue ? this.loadVueProgram() : this.loadDefaultProgram();

    if (this.linterConfig) {
      this.linter = this.createLinter(this.program!);
    }
  }

  private loadVueProgram() {
    this.programConfig =
      this.programConfig ||
      VueProgram.loadProgramConfig(
        this.programConfigFile,
        this.compilerOptions
      );

    return VueProgram.createProgram(
      this.programConfig,
      path.dirname(this.programConfigFile),
      this.files,
      this.watcher!,
      this.program!
    );
  }

  private loadDefaultProgram() {
    this.programConfig =
      this.programConfig ||
      IncrementalChecker.loadProgramConfig(
        this.programConfigFile,
        this.compilerOptions
      );

    return IncrementalChecker.createProgram(
      this.programConfig,
      this.files,
      this.watcher!,
      this.program!
    );
  }

  public getDiagnostics(cancellationToken: CancellationToken) {
    const { program } = this;
    if (!program) {
      throw new Error('Invoked called before program initialized');
    }
    const diagnostics: ts.Diagnostic[] = [];
    // select files to check (it's semantic check - we have to include all files :/)
    const filesToCheck = program.getSourceFiles();

    // calculate subset of work to do
    const workSet = new WorkSet(
      filesToCheck,
      this.workNumber,
      this.workDivision
    );

    // check given work set
    workSet.forEach(sourceFile => {
      if (cancellationToken) {
        cancellationToken.throwIfCancellationRequested();
      }

      const diagnosticsToRegister: ReadonlyArray<ts.Diagnostic> = this
        .checkSyntacticErrors
        ? program
            .getSemanticDiagnostics(sourceFile, cancellationToken)
            .concat(
              program.getSyntacticDiagnostics(sourceFile, cancellationToken)
            )
        : program.getSemanticDiagnostics(sourceFile, cancellationToken);

      diagnostics.push(...diagnosticsToRegister);
    });

    // normalize and deduplicate diagnostics
    return NormalizedMessage.deduplicate(
      diagnostics.map(NormalizedMessage.createFromDiagnostic)
    );
  }

  public getLints(cancellationToken: CancellationToken) {
    const { linter } = this;
    if (!linter) {
      throw new Error('Cannot get lints - checker has no linter.');
    }

    // select files to lint
    const filesToLint = this.files
      .keys()
      .filter(
        filePath =>
          !this.files.getData(filePath).linted &&
          !IncrementalChecker.isFileExcluded(filePath, this.linterExclusions)
      );

    // calculate subset of work to do
    const workSet = new WorkSet(
      filesToLint,
      this.workNumber,
      this.workDivision
    );

    // lint given work set
    workSet.forEach(fileName => {
      cancellationToken.throwIfCancellationRequested();

      try {
        // Assertion: `.lint` second parameter can be undefined
        linter.lint(fileName, undefined!, this.linterConfig);
      } catch (e) {
        if (
          FsHelper.existsSync(fileName) &&
          // check the error type due to file system lag
          !(e instanceof Error) &&
          !(e.constructor.name === 'FatalError') &&
          !(e.message && e.message.trim().startsWith('Invalid source file'))
        ) {
          // it's not because file doesn't exist - throw error
          throw e;
        }
      }
    });

    // set lints in files register
    linter.getResult().failures.forEach(lint => {
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
    const lints = this.files
      .keys()
      .reduce(
        (innerLints, filePath) =>
          innerLints.concat(this.files.getData(filePath).lints),
        [] as RuleFailure[]
      );

    // normalize and deduplicate lints
    return NormalizedMessage.deduplicate(
      lints.map(NormalizedMessage.createFromLint)
    );
  }
}
