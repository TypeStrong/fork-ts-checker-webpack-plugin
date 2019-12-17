// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
// tslint:disable-next-line:no-implicit-dependencies
import * as tslint from 'tslint'; // Imported for types alone
// tslint:disable-next-line:no-implicit-dependencies
import * as eslint from 'eslint'; // Imported for types alone
import * as path from 'path';
import * as minimatch from 'minimatch';

import {
  IncrementalCheckerInterface,
  IncrementalCheckerParams
} from './IncrementalCheckerInterface';
import { CancellationToken } from './CancellationToken';
import {
  ConfigurationFile,
  loadLinterConfig,
  makeGetLinterConfig
} from './linterConfigHelpers';
import { CompilerHost } from './CompilerHost';
import { fileExistsSync } from './FsHelper';
import { createEslinter } from './createEslinter';
import {
  createIssuesFromTsDiagnostics,
  createIssuesFromTsLintRuleFailures,
  createIssuesFromEsLintReports
} from './issue';

export class ApiIncrementalChecker implements IncrementalCheckerInterface {
  private linterConfig?: ConfigurationFile;
  private linterConfigs: Record<string, ConfigurationFile | undefined> = {};

  protected readonly tsIncrementalCompiler: CompilerHost;
  private linterExclusions: minimatch.IMinimatch[] = [];

  private currentLintErrors = new Map<string, tslint.LintResult>();
  private currentEsLintErrors = new Map<string, eslint.CLIEngine.LintReport>();
  private lastUpdatedFiles: string[] = [];
  private lastRemovedFiles: string[] = [];

  private readonly hasFixedConfig: boolean;

  private readonly context: string;
  private readonly linterConfigFile: string | boolean;
  private readonly linterAutoFix: boolean;
  private readonly eslinter: ReturnType<typeof createEslinter> | undefined;

  constructor({
    typescript,
    context,
    programConfigFile,
    compilerOptions,
    linterConfigFile,
    linterAutoFix,
    eslinter,
    vue,
    checkSyntacticErrors = false,
    resolveModuleName,
    resolveTypeReferenceDirective
  }: IncrementalCheckerParams) {
    this.context = context;
    this.linterConfigFile = linterConfigFile;
    this.linterAutoFix = linterAutoFix;
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

  private createLinter(program: ts.Program): tslint.Linter {
    // tslint:disable-next-line:no-implicit-dependencies
    const { Linter } = require('tslint');

    return new Linter({ fix: this.linterAutoFix }, program);
  }

  public hasTsLinter(): boolean {
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

  public async getTypeScriptIssues(_cancellationToken: CancellationToken) {
    const tsDiagnostics = await this.tsIncrementalCompiler.processChanges();
    this.lastUpdatedFiles = tsDiagnostics.updatedFiles;
    this.lastRemovedFiles = tsDiagnostics.removedFiles;

    return createIssuesFromTsDiagnostics(tsDiagnostics.results);
  }

  public async getTsLintIssues(_cancellationToken: CancellationToken) {
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

    return createIssuesFromTsLintRuleFailures(allLints);
  }

  public async getEsLintIssues(cancellationToken: CancellationToken) {
    for (const removedFile of this.lastRemovedFiles) {
      this.currentEsLintErrors.delete(removedFile);
    }

    for (const updatedFile of this.lastUpdatedFiles) {
      cancellationToken.throwIfCancellationRequested();
      if (this.isFileExcluded(updatedFile)) {
        continue;
      }

      const report = this.eslinter!.getReport(updatedFile);

      if (report !== undefined) {
        this.currentEsLintErrors.set(updatedFile, report);
      } else if (this.currentEsLintErrors.has(updatedFile)) {
        this.currentEsLintErrors.delete(updatedFile);
      }
    }

    const reports = Array.from(this.currentEsLintErrors.values());
    return createIssuesFromEsLintReports(reports);
  }
}
