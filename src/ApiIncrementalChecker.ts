import * as ts from 'typescript';
import * as minimatch from 'minimatch';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { CancellationToken } from './CancellationToken';
import { NormalizedMessage } from './NormalizedMessage';
import { Configuration, Linter } from 'tslint';
import { CompilerHost } from './CompilerHost';

// Need some augmentation here - linterOptions.exclude is not (yet) part of the official
// types for tslint.
interface ConfigurationFile extends Configuration.IConfigurationFile {
  linterOptions?: {
    typeCheck?: boolean;
    exclude?: string[];
  };
}

export class ApiIncrementalChecker implements IncrementalCheckerInterface {
  private linter?: Linter;
  private linterConfig?: ConfigurationFile;

  // Use empty array of exclusions in general to avoid having
  // to check of its existence later on.
  // private linterExclusions: minimatch.IMinimatch[] = [];

  private readonly program: ts.Program;
  private resolveCompilationPromise: () => void;
  private _gatheredDiagnostics: ts.Diagnostic[] = [];
  private readonly watchProgram: ts.WatchOfConfigFile<
    ts.SemanticDiagnosticsBuilderProgram
  >;
  private _compilationPromise = Promise.resolve();
  private readonly proxyFilesystem: CompilerHost;

  constructor(
    private programConfigFile: string,
    private compilerOptions: ts.CompilerOptions,
    private linterConfigFile: string | false,
    private linterAutoFix: boolean,
    watchPaths: string[]
  ) {
    this.initLinterConfig();

    const host = ts.createWatchCompilerHost(
      this.programConfigFile,
      this.compilerOptions,
      ts.sys,
      ts.createSemanticDiagnosticsBuilderProgram,
      (diag: ts.Diagnostic) => {
        this._gatheredDiagnostics.push(diag);
      },
      () => {
        // do not report watch status changes
      }
    );

    this.proxyFilesystem = new CompilerHost(watchPaths);

    const methods = [
      'fileExists',
      'readFile',
      'directoryExists',
      'getDirectories',
      'readDirectory',
      'watchDirectory',
      'watchFile',
      'setTimeout',
      'clearTimeout',
      'realpath',
      'onWatchStatusChange'
    ];
    for (const m of methods) {
      host[m] = this.proxyFilesystem[m].bind(this.proxyFilesystem);
    }

    this.resolveCompilationPromise = () => {
      // do nothing
    };

    const originalAfterProgramCreate = host.afterProgramCreate;
    host.afterProgramCreate = p => {
      originalAfterProgramCreate!(p);
      this.resolveCompilationPromise();
    };
    this.watchProgram = ts.createWatchProgram(host);
    this.program = this.watchProgram.getProgram().getProgram();
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
        // this.linterExclusions = this.linterConfig.linterOptions.exclude.map(
        //   pattern => new minimatch.Minimatch(path.resolve(pattern))
        // );
      }
    }
  }

  private static loadLinterConfig(configFile: string): ConfigurationFile {
    const tslint = require('tslint');

    return tslint.Configuration.loadConfigurationFromPath(
      configFile
    ) as ConfigurationFile;
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
    this._compilationPromise = new Promise<void>(resolve => {
      this.resolveCompilationPromise = () => {
        resolve();
      };
    });

    if (!this.proxyFilesystem.fireWatchEvents()) {
      // everything is updated and compiler was not triggered at all
      this.resolveCompilationPromise();
    }

    if (this.linterConfig) {
      this.linter = this.createLinter(this.program);
    }
  }

  public async getDiagnostics(_cancellationToken: CancellationToken) {
    await this._compilationPromise;

    const diagnostics = this._gatheredDiagnostics;
    this._gatheredDiagnostics = [];
    // normalize and deduplicate diagnostics
    return NormalizedMessage.deduplicate(
      diagnostics.map(NormalizedMessage.createFromDiagnostic)
    );
  }

  public getLints(_cancellationToken: CancellationToken) {
    return [];
    // const { linter } = this;
    // if (!linter) {
    //   throw new Error('Cannot get lints - checker has no linter.');
    // }
    //
    // // select files to lint
    // const filesToLint = this.files
    //   .keys()
    //   .filter(
    //     filePath =>
    //       !this.files.getData(filePath).linted &&
    //       !ApiIncrementalChecker.isFileExcluded(filePath, this.linterExclusions)
    //   );
    //
    // // calculate subset of work to do
    // const workSet = new WorkSet(
    //   filesToLint,
    //   this.workNumber,
    //   this.workDivision
    // );
    //
    // // lint given work set
    // workSet.forEach(fileName => {
    //   cancellationToken.throwIfCancellationRequested();
    //
    //   try {
    //     // Assertion: `.lint` second parameter can be undefined
    //     linter.lint(fileName, undefined!, this.linterConfig);
    //   } catch (e) {
    //     if (
    //       FsHelper.existsSync(fileName) &&
    //       // check the error type due to file system lag
    //       !(e instanceof Error) &&
    //       !(e.constructor.name === 'FatalError') &&
    //       !(e.message && e.message.trim().startsWith('Invalid source file'))
    //     ) {
    //       // it's not because file doesn't exist - throw error
    //       throw e;
    //     }
    //   }
    // });
    //
    // // set lints in files register
    // linter.getResult().failures.forEach(lint => {
    //   const filePath = lint.getFileName();
    //
    //   this.files.mutateData(filePath, data => {
    //     data.linted = true;
    //     data.lints.push(lint);
    //   });
    // });
    //
    // // set all files as linted
    // this.files.keys().forEach(filePath => {
    //   this.files.mutateData(filePath, data => {
    //     data.linted = true;
    //   });
    // });
    //
    // // get all lints
    // const lints = this.files
    //   .keys()
    //   .reduce(
    //     (innerLints, filePath) =>
    //       innerLints.concat(this.files.getData(filePath).lints),
    //     [] as RuleFailure[]
    //   );
    //
    // // normalize and deduplicate lints
    // return NormalizedMessage.deduplicate(
    //   lints.map(NormalizedMessage.createFromLint)
    // );
  }
}
