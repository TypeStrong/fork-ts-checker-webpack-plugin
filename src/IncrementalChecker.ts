import * as fs from 'fs';
import * as path from 'path';
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone; actual requires take place in methods below
// tslint:disable-next-line:no-implicit-dependencies
import { Linter, RuleFailure } from 'tslint'; // Imported for types alone; actual requires take place in methods below
import { FilesRegister } from './FilesRegister';
import { FilesWatcher } from './FilesWatcher';
import {
  ConfigurationFile,
  loadLinterConfig,
  makeGetLinterConfig
} from './linterConfigHelpers';
import { WorkSet } from './WorkSet';
import { NormalizedMessage } from './NormalizedMessage';
import { CancellationToken } from './CancellationToken';
import * as minimatch from 'minimatch';
import { FsHelper } from './FsHelper';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { PluggableProgramFactoryInterface } from './PluggableProgramFactory';
import BasicProgramFactory from './BasicProgramFactory';

export class IncrementalChecker implements IncrementalCheckerInterface {
  // it's shared between compilations
  private linterConfigs: Record<string, ConfigurationFile | undefined> = {};
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

  private readonly hasFixedConfig: boolean;

  constructor(
    private typescript: typeof ts,
    private createNormalizedMessageFromDiagnostic: (
      diagnostic: ts.Diagnostic
    ) => NormalizedMessage,
    private createNormalizedMessageFromRuleFailure: (
      ruleFailure: RuleFailure
    ) => NormalizedMessage,
    private programConfigFile: string,
    private compilerOptions: object,
    private context: string,
    private linterConfigFile: string | boolean,
    private linterAutoFix: boolean,
    private watchPaths: string[],
    private workNumber: number = 0,
    private workDivision: number = 1,
    private checkSyntacticErrors: boolean = false,
    private pluggableProgramFactory: PluggableProgramFactoryInterface = BasicProgramFactory
  ) {
    this.hasFixedConfig = typeof this.linterConfigFile === 'string';
  }

  private getLinterConfig: (
    file: string
  ) => ConfigurationFile | undefined = makeGetLinterConfig(
    this.linterConfigs,
    this.linterExclusions,
    this.context
  );

  private createLinter(program: ts.Program) {
    // tslint:disable-next-line:no-implicit-dependencies
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
      const watchExtensions = this.pluggableProgramFactory.watchExtensions;
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

    if (!this.linterConfig && this.hasFixedConfig) {
      this.linterConfig = loadLinterConfig(this.linterConfigFile as string);

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

    const { program, programConfig } = this.pluggableProgramFactory.loadProgram(
      {
        typescript: this.typescript,
        configFile: this.programConfigFile,
        programConfig: this.programConfig,
        compilerOptions: this.compilerOptions,
        files: this.files,
        watcher: this.watcher,
        oldProgram: this.program
      }
    );
    this.programConfig = programConfig;
    this.program = program;

    if (this.linterConfigFile) {
      this.linter = this.createLinter(this.program!);
    }
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
    const workSet = new WorkSet<ts.SourceFile>(
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
    return Promise.resolve(
      NormalizedMessage.deduplicate(
        diagnostics.map(this.createNormalizedMessageFromDiagnostic)
      )
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
    const workSet = new WorkSet<string>(
      filesToLint,
      this.workNumber,
      this.workDivision
    );

    // lint given work set
    workSet.forEach(fileName => {
      cancellationToken.throwIfCancellationRequested();
      const config = this.hasFixedConfig
        ? this.linterConfig
        : this.getLinterConfig(fileName);
      if (!config) {
        return;
      }

      try {
        // Assertion: `.lint` second parameter can be undefined
        linter.lint(fileName, undefined!, config);
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
      lints.map(this.createNormalizedMessageFromRuleFailure)
    );
  }
}
