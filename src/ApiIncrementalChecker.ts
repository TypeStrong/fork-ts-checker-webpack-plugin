// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
// tslint:disable-next-line:no-implicit-dependencies
import { Linter, LintResult, RuleFailure } from 'tslint';
import * as minimatch from 'minimatch';
import * as path from 'path';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { CancellationToken } from './CancellationToken';
import {
  ConfigurationFile,
  loadLinterConfig,
  makeGetLinterConfig
} from './linterConfigHelpers';
import { NormalizedMessage } from './NormalizedMessage';
import { CompilerHost } from './CompilerHost';
import { FsHelper } from './FsHelper';

export class ApiIncrementalChecker implements IncrementalCheckerInterface {
  private linterConfig?: ConfigurationFile;
  private linterConfigs: Record<string, ConfigurationFile | undefined> = {};

  private readonly tsIncrementalCompiler: CompilerHost;
  private linterExclusions: minimatch.IMinimatch[] = [];

  private currentLintErrors = new Map<string, LintResult>();
  private lastUpdatedFiles: string[] = [];
  private lastRemovedFiles: string[] = [];

  private readonly hasFixedConfig: boolean;

  constructor(
    typescript: typeof ts,
    private createNormalizedMessageFromDiagnostic: (
      diagnostic: ts.Diagnostic
    ) => NormalizedMessage,
    private createNormalizedMessageFromRuleFailure: (
      ruleFailure: RuleFailure
    ) => NormalizedMessage,
    programConfigFile: string,
    compilerOptions: ts.CompilerOptions,
    private context: string,
    private linterConfigFile: string | boolean,
    private linterAutoFix: boolean,
    checkSyntacticErrors: boolean
  ) {
    this.hasFixedConfig = typeof this.linterConfigFile === 'string';

    this.initLinterConfig();

    this.tsIncrementalCompiler = new CompilerHost(
      typescript,
      programConfigFile,
      compilerOptions,
      checkSyntacticErrors
    );
  }

  private initLinterConfig() {
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
  }

  private getLinterConfig: (
    file: string
  ) => ConfigurationFile | undefined = makeGetLinterConfig(
    this.linterConfigs,
    this.linterExclusions,
    this.context
  );

  private createLinter(program: ts.Program): Linter {
    // tslint:disable-next-line:no-implicit-dependencies
    const tslint = require('tslint');

    return new tslint.Linter({ fix: this.linterAutoFix }, program);
  }

  public hasLinter(): boolean {
    return !!this.linterConfigFile;
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
      diagnostics.results.map(this.createNormalizedMessageFromDiagnostic)
    );
  }

  public getLints(_cancellationToken: CancellationToken) {
    for (const updatedFile of this.lastUpdatedFiles) {
      if (this.isFileExcluded(updatedFile)) {
        continue;
      }

      try {
        const linter = this.createLinter(
          this.tsIncrementalCompiler.getProgram()
        );
        const config = this.hasFixedConfig
          ? this.linterConfig
          : this.getLinterConfig(updatedFile);
        if (!config) {
          continue;
        }
        // const source = fs.readFileSync(updatedFile, 'utf-8');
        linter.lint(updatedFile, undefined!, config);
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
      allLints.map(this.createNormalizedMessageFromRuleFailure)
    );
  }
}
