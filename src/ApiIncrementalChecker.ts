import * as ts from 'typescript';
import * as minimatch from 'minimatch';
import * as path from 'path';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { CancellationToken } from './CancellationToken';
import { NormalizedMessage } from './NormalizedMessage';
import { Configuration, Linter } from 'tslint';
import { CompilerHost } from './CompilerHost';
import { WorkSet } from './WorkSet';
import { FsHelper } from './FsHelper';

// Need some augmentation here - linterOptions.exclude is not (yet) part of the official
// types for tslint.
interface ConfigurationFile extends Configuration.IConfigurationFile {
  linterOptions?: {
    typeCheck?: boolean;
    exclude?: string[];
  };
}

export class ApiIncrementalChecker implements IncrementalCheckerInterface {
  private linterConfig?: ConfigurationFile;

  // Use empty array of exclusions in general to avoid having
  // to check of its existence later on.
  // private linterExclusions: minimatch.IMinimatch[] = [];

  private readonly tsIncrementalCompiler: CompilerHost;
  private linterExclusions: minimatch.IMinimatch[] = [];

  constructor(
    programConfigFile: string,
    compilerOptions: ts.CompilerOptions,
    private linterConfigFile: string | false,
    private linterAutoFix: boolean,
    private workNumber: number,
    private workDivision: number,
    checkSyntacticErrors: boolean
  ) {
    this.initLinterConfig();

    this.tsIncrementalCompiler = new CompilerHost(programConfigFile, compilerOptions, checkSyntacticErrors);
  }

  private initLinterConfig() {
    if (!this.linterConfig && this.linterConfigFile) {
      this.linterConfig = ApiIncrementalChecker.loadLinterConfig(
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
  }

  private static loadLinterConfig(configFile: string): ConfigurationFile {
    const tslint = require('tslint');

    return tslint.Configuration.loadConfigurationFromPath(
      configFile
    ) as ConfigurationFile;
  }

  private createLinter(program: ts.Program): Linter {
    const tslint = require('tslint');

    return new tslint.Linter({ fix: this.linterAutoFix }, program);
  }

  public hasLinter(): boolean {
    return !!this.linterConfig;
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
    // do nothing
  }

  public async getDiagnostics(_cancellationToken: CancellationToken) {
    const diagnostics = await this.tsIncrementalCompiler.processChanges();
    return NormalizedMessage.deduplicate(
      diagnostics.map(NormalizedMessage.createFromDiagnostic)
    );
  }

  public getLints(cancellationToken: CancellationToken) {
    if (!this.linterConfig) {
      return [];
    }

    const linter = this.createLinter(this.tsIncrementalCompiler.getProgram());

    const files = this.tsIncrementalCompiler.getFiles();

    // calculate subset of work to do
    const workSet = new WorkSet(
      Array.from(files.keys()),
      this.workNumber,
      this.workDivision
    );

    // lint given work set
    workSet.forEach(fileName => {
      cancellationToken.throwIfCancellationRequested();

      if (ApiIncrementalChecker.isFileExcluded(fileName, this.linterExclusions)) {
        return;
      }

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

    const lints = linter.getResult().failures;

    // normalize and deduplicate lints
    return NormalizedMessage.deduplicate(
      lints.map(NormalizedMessage.createFromLint)
    );
  }
}
