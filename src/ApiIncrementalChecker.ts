// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
// tslint:disable-next-line:no-implicit-dependencies
import { Linter, LintResult, RuleFailure } from 'tslint'; // Imported for types alone
// tslint:disable-next-line:no-implicit-dependencies
import * as eslinttypes from 'eslint'; // Imported for types alone
import * as minimatch from 'minimatch';
import * as path from 'path';
import {
  IncrementalCheckerInterface,
  ApiIncrementalCheckerParams
} from './IncrementalCheckerInterface';
import { CancellationToken } from './CancellationToken';
import {
  ConfigurationFile,
  loadLinterConfig,
  makeGetLinterConfig
} from './linterConfigHelpers';
import { NormalizedMessage } from './NormalizedMessage';
import { CompilerHost } from './CompilerHost';
import { fileExistsSync } from './FsHelper';
import { createEslinter } from './createEslinter';

export class ApiIncrementalChecker implements IncrementalCheckerInterface {
  private linterConfig?: ConfigurationFile;
  private linterConfigs: Record<string, ConfigurationFile | undefined> = {};

  protected readonly tsIncrementalCompiler: CompilerHost;
  private linterExclusions: minimatch.IMinimatch[] = [];

  private currentLintErrors = new Map<string, LintResult>();
  private currentEsLintErrors = new Map<
    string,
    eslinttypes.CLIEngine.LintReport
  >();
  private lastUpdatedFiles: string[] = [];
  private lastRemovedFiles: string[] = [];

  private readonly hasFixedConfig: boolean;

  private readonly context: string;
  private readonly createNormalizedMessageFromDiagnostic: (
    diagnostic: ts.Diagnostic
  ) => NormalizedMessage;
  private readonly linterConfigFile: string | boolean;
  private readonly linterAutoFix: boolean;
  private readonly createNormalizedMessageFromRuleFailure: (
    ruleFailure: RuleFailure
  ) => NormalizedMessage;
  private readonly eslinter: ReturnType<typeof createEslinter> | undefined;

  constructor({
    typescript,
    context,
    programConfigFile,
    compilerOptions,
    createNormalizedMessageFromDiagnostic,
    linterConfigFile,
    linterAutoFix,
    createNormalizedMessageFromRuleFailure,
    eslinter,
    vue,
    checkSyntacticErrors = false,
    resolveModuleName,
    resolveTypeReferenceDirective
  }: ApiIncrementalCheckerParams) {
    this.context = context;
    this.createNormalizedMessageFromDiagnostic = createNormalizedMessageFromDiagnostic;
    this.linterConfigFile = linterConfigFile;
    this.linterAutoFix = linterAutoFix;
    this.createNormalizedMessageFromRuleFailure = createNormalizedMessageFromRuleFailure;
    this.eslinter = eslinter;

    this.hasFixedConfig = typeof this.linterConfigFile === 'string';

    this.initLinterConfig();

    this.tsIncrementalCompiler = new CompilerHost(
      typescript,
      vue,
      programConfigFile,
      compilerOptions,
      checkSyntacticErrors,
      resolveModuleName,
      resolveTypeReferenceDirective
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

  public hasEsLinter(): boolean {
    return this.eslinter !== undefined;
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
          fileExistsSync(updatedFile) &&
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

  public getEsLints(cancellationToken: CancellationToken) {
    for (const removedFile of this.lastRemovedFiles) {
      this.currentEsLintErrors.delete(removedFile);
    }

    for (const updatedFile of this.lastUpdatedFiles) {
      cancellationToken.throwIfCancellationRequested();
      if (this.isFileExcluded(updatedFile)) {
        continue;
      }

      const lints = this.eslinter!.getLints(updatedFile);
      if (lints !== undefined) {
        this.currentEsLintErrors.set(updatedFile, lints);
      } else if (this.currentEsLintErrors.has(updatedFile)) {
        this.currentEsLintErrors.delete(updatedFile);
      }
    }

    return this.eslinter!.getFormattedLints(this.currentEsLintErrors.values());
  }
}
