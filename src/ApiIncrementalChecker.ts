import * as ts from 'typescript';
import * as minimatch from 'minimatch';
import * as path from 'path';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { CancellationToken } from './CancellationToken';
import { NormalizedMessage } from './NormalizedMessage';
import { Configuration, Linter, LintResult } from 'tslint';
import { CompilerHost } from './CompilerHost';
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

  private readonly tsIncrementalCompiler: CompilerHost;
  private linterExclusions: minimatch.IMinimatch[] = [];

  private currentLintErrors = new Map<string, LintResult>();
  private lastUpdatedFiles: string[] = [];
  private lastRemovedFiles: string[] = [];

  constructor(
    programConfigFile: string,
    compilerOptions: ts.CompilerOptions,
    private linterConfigFile: string | false,
    private linterAutoFix: boolean,
    checkSyntacticErrors: boolean
  ) {
    this.initLinterConfig();

    this.tsIncrementalCompiler = new CompilerHost(
      programConfigFile,
      compilerOptions,
      checkSyntacticErrors
    );
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

  public isFileExcluded(filePath: string): boolean {
    return (
      filePath.endsWith('.d.ts') ||
      this.linterExclusions.some(matcher => matcher.match(filePath))
    );
  }

  public nextIteration() {
    // do nothing
  }

  public async getDiagnostics(_cancellationToken: CancellationToken) {
    const diagnostics = await this.tsIncrementalCompiler.processChanges();
    this.lastUpdatedFiles = diagnostics.updatedFiles;
    this.lastRemovedFiles = diagnostics.removedFiles;

    return NormalizedMessage.deduplicate(
      diagnostics.results.map(NormalizedMessage.createFromDiagnostic)
    );
  }

  public getLints(_cancellationToken: CancellationToken) {
    if (!this.linterConfig) {
      return [];
    }

    for (const updatedFile of this.lastUpdatedFiles) {
      if (this.isFileExcluded(updatedFile)) {
        continue;
      }

      try {
        const linter = this.createLinter(
          this.tsIncrementalCompiler.getProgram()
        );
        // const source = fs.readFileSync(updatedFile, 'utf-8');
        linter.lint(updatedFile, undefined!, this.linterConfig);
        const lints = linter.getResult();
        this.currentLintErrors.set(updatedFile, lints);
      } catch (e) {
        if (
          FsHelper.existsSync(updatedFile) &&
          // check the error type due to file system lag
          !(e instanceof Error) &&
          !(e.constructor.name === 'FatalError') &&
          !(e.message && e.message.trim().startsWith('Invalid source file'))
        ) {
          // it's not because file doesn't exist - throw error
          throw e;
        }
      }

      for (const removedFile of this.lastRemovedFiles) {
        this.currentLintErrors.delete(removedFile);
      }
    }

    const allLints = [];
    for (const [, value] of this.currentLintErrors) {
      allLints.push(...value.failures);
    }

    return NormalizedMessage.deduplicate(
      allLints.map(NormalizedMessage.createFromLint)
    );
  }
}
