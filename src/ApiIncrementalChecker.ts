// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
// tslint:disable-next-line:no-implicit-dependencies
import { Linter, LintResult, RuleFailure } from 'tslint';
import * as eslinttypes from 'eslint';
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
import { ResolveModuleName, ResolveTypeReferenceDirective } from './resolution';
import { FsHelper } from './FsHelper';

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

  constructor(
    typescript: typeof ts,
    private context: string,
    programConfigFile: string,
    compilerOptions: ts.CompilerOptions,
    private createNormalizedMessageFromDiagnostic: (
      diagnostic: ts.Diagnostic
    ) => NormalizedMessage,
    private linterConfigFile: string | boolean,
    private linterAutoFix: boolean,
    private createNormalizedMessageFromRuleFailure: (
      ruleFailure: RuleFailure
    ) => NormalizedMessage,
    private eslint: boolean,
    private createNormalizedMessageFromEsLintFailure: (
      ruleFailure: eslinttypes.Linter.LintMessage,
      filePath: string
    ) => NormalizedMessage,
    checkSyntacticErrors: boolean,
    resolveModuleName: ResolveModuleName | undefined,
    resolveTypeReferenceDirective: ResolveTypeReferenceDirective | undefined
  ) {
    this.hasFixedConfig = typeof this.linterConfigFile === 'string';

    this.initLinterConfig();

    this.tsIncrementalCompiler = new CompilerHost(
      typescript,
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
    return this.eslint;
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

  public getEsLints(_cancellationToken: CancellationToken) {
    for (const updatedFile of this.lastUpdatedFiles) {
      if (this.isFileExcluded(updatedFile)) {
        continue;
      }

      try {
        // See https://eslint.org/docs/1.0.0/developer-guide/nodejs-api#cliengine
        const eslint: typeof eslinttypes = require('eslint');
        const linter = new eslint.CLIEngine({});

        const lints = linter.executeOnFiles([updatedFile]);
        this.currentEsLintErrors.set(updatedFile, lints);
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
        this.currentEsLintErrors.delete(removedFile);
      }
    }

    const allEsLints = [];
    for (const [, value] of this.currentEsLintErrors) {
      for (const lint of value.results) {
        allEsLints.push(
          ...lint.messages.map(message =>
            this.createNormalizedMessageFromEsLintFailure(
              message,
              lint.filePath
            )
          )
        );
      }
    }

    return NormalizedMessage.deduplicate(allEsLints);
  }
}
