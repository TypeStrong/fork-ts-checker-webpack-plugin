import * as fs from 'fs';
import * as path from 'path';
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone; actual requires take place in methods below
// tslint:disable-next-line:no-implicit-dependencies
import * as tslint from 'tslint'; // Imported for types alone; actual requires take place in methods below
// tslint:disable-next-line:no-implicit-dependencies
import * as eslint from 'eslint';
import * as minimatch from 'minimatch';

import { FilesRegister } from './FilesRegister';
import {
  ConfigurationFile,
  loadLinterConfig,
  makeGetLinterConfig
} from './linterConfigHelpers';
import { CancellationToken } from './CancellationToken';
import {
  ResolveModuleName,
  ResolveTypeReferenceDirective,
  makeResolutionFunctions
} from './resolution';
import { VueProgram } from './VueProgram';
import { throwIfIsInvalidSourceFileError } from './FsHelper';
import {
  IncrementalCheckerInterface,
  IncrementalCheckerParams
} from './IncrementalCheckerInterface';
import { createEslinter } from './createEslinter';
import { VueOptions } from './types/vue-options';
import {
  Issue,
  createIssuesFromEsLintReports,
  createIssuesFromTsDiagnostics,
  createIssuesFromTsLintRuleFailures
} from './issue';

export class IncrementalChecker implements IncrementalCheckerInterface {
  // it's shared between compilations
  private linterConfigs: Record<string, ConfigurationFile | undefined> = {};
  private files = new FilesRegister(() => ({
    // data shape
    source: undefined,
    linted: false,
    tslints: [],
    eslints: []
  }));

  private linter?: tslint.Linter;
  private linterConfig?: ConfigurationFile;

  // Use empty array of exclusions in general to avoid having
  // to check of its existence later on.
  private linterExclusions: minimatch.IMinimatch[] = [];

  protected program?: ts.Program;
  protected programConfig?: ts.ParsedCommandLine;

  private readonly hasFixedConfig: boolean;

  private readonly typescript: typeof ts;
  private readonly context: string;
  private readonly programConfigFile: string;
  private readonly compilerOptions: object;
  private readonly linterConfigFile: string | boolean;
  private readonly linterAutoFix: boolean;
  private readonly eslinter: ReturnType<typeof createEslinter> | undefined;
  private readonly vue: VueOptions;
  private readonly checkSyntacticErrors: boolean;
  private readonly resolveModuleName: ResolveModuleName | undefined;
  private readonly resolveTypeReferenceDirective:
    | ResolveTypeReferenceDirective
    | undefined;

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
    this.typescript = typescript;
    this.context = context;
    this.programConfigFile = programConfigFile;
    this.compilerOptions = compilerOptions;
    this.linterConfigFile = linterConfigFile;
    this.linterAutoFix = linterAutoFix;
    this.eslinter = eslinter;
    this.vue = vue;
    this.checkSyntacticErrors = checkSyntacticErrors;
    this.resolveModuleName = resolveModuleName;
    this.resolveTypeReferenceDirective = resolveTypeReferenceDirective;

    this.hasFixedConfig = typeof this.linterConfigFile === 'string';
  }

  public static loadProgramConfig(
    typescript: typeof ts,
    configFile: string,
    compilerOptions: object
  ) {
    const tsconfig = typescript.readConfigFile(
      configFile,
      typescript.sys.readFile
    ).config;

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions = {
      ...tsconfig.compilerOptions,
      ...compilerOptions
    };

    const parsed = typescript.parseJsonConfigFileContent(
      tsconfig,
      typescript.sys,
      path.dirname(configFile)
    );

    return parsed;
  }

  private getLinterConfig: (
    file: string
  ) => ConfigurationFile | undefined = makeGetLinterConfig(
    this.linterConfigs,
    this.linterExclusions,
    this.context
  );

  private static createProgram(
    typescript: typeof ts,
    programConfig: ts.ParsedCommandLine,
    files: FilesRegister,
    oldProgram: ts.Program,
    userResolveModuleName: ResolveModuleName | undefined,
    userResolveTypeReferenceDirective: ResolveTypeReferenceDirective | undefined
  ) {
    const host = typescript.createCompilerHost(programConfig.options);
    const realGetSourceFile = host.getSourceFile;

    const {
      resolveModuleName,
      resolveTypeReferenceDirective
    } = makeResolutionFunctions(
      userResolveModuleName,
      userResolveTypeReferenceDirective
    );

    host.resolveModuleNames = (moduleNames, containingFile) => {
      return moduleNames.map(moduleName => {
        return resolveModuleName(
          typescript,
          moduleName,
          containingFile,
          programConfig.options,
          host
        ).resolvedModule;
      });
    };

    host.resolveTypeReferenceDirectives = (
      typeDirectiveNames,
      containingFile
    ) => {
      return typeDirectiveNames.map(typeDirectiveName => {
        return resolveTypeReferenceDirective(
          typescript,
          typeDirectiveName,
          containingFile,
          programConfig.options,
          host
        ).resolvedTypeReferenceDirective;
      });
    };

    host.getSourceFile = (filePath, languageVersion, onError) => {
      try {
        const stats = fs.statSync(filePath);

        files.setMtime(filePath, stats.mtime.valueOf());
      } catch (e) {
        // probably file does not exists
        files.remove(filePath);
      }

      // get source file only if there is no source in files register
      if (!files.has(filePath) || !files.getData(filePath).source) {
        files.mutateData(filePath, data => {
          data.source = realGetSourceFile(filePath, languageVersion, onError);
        });
      }

      return files.getData(filePath).source;
    };

    return typescript.createProgram(
      programConfig.fileNames,
      programConfig.options,
      host,
      oldProgram // re-use old program
    );
  }

  private createLinter(program: ts.Program) {
    // tslint:disable-next-line:no-implicit-dependencies
    const tslint = require('tslint');

    return new tslint.Linter({ fix: this.linterAutoFix }, program);
  }

  public hasTsLinter(): boolean {
    return !!this.linter;
  }

  public hasEsLinter(): boolean {
    return this.eslinter !== undefined;
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

    this.program = this.vue.enabled
      ? this.loadVueProgram(this.vue)
      : this.loadDefaultProgram();

    if (this.linterConfigFile) {
      this.linter = this.createLinter(this.program!);
    }
  }

  private loadVueProgram(vueOptions: VueOptions) {
    this.programConfig =
      this.programConfig ||
      VueProgram.loadProgramConfig(
        this.typescript,
        this.programConfigFile,
        this.compilerOptions
      );

    return VueProgram.createProgram(
      this.typescript,
      this.programConfig,
      path.dirname(this.programConfigFile),
      this.files,
      this.program!,
      this.resolveModuleName,
      this.resolveTypeReferenceDirective,
      vueOptions
    );
  }

  private loadDefaultProgram() {
    this.programConfig =
      this.programConfig ||
      IncrementalChecker.loadProgramConfig(
        this.typescript,
        this.programConfigFile,
        this.compilerOptions
      );

    return IncrementalChecker.createProgram(
      this.typescript,
      this.programConfig,
      this.files,
      this.program!,
      this.resolveModuleName,
      this.resolveTypeReferenceDirective
    );
  }

  public async getTypeScriptIssues(
    cancellationToken: CancellationToken
  ): Promise<Issue[]> {
    const { program } = this;
    if (!program) {
      throw new Error('Invoked called before program initialized');
    }
    const tsDiagnostics: ts.Diagnostic[] = [];
    // select files to check (it's semantic check - we have to include all files :/)
    const filesToCheck = program.getSourceFiles();

    filesToCheck.forEach(sourceFile => {
      if (cancellationToken) {
        cancellationToken.throwIfCancellationRequested();
      }

      const tsDiagnosticsToRegister: ReadonlyArray<ts.Diagnostic> = this
        .checkSyntacticErrors
        ? program
            .getSemanticDiagnostics(sourceFile, cancellationToken)
            .concat(
              program.getSyntacticDiagnostics(sourceFile, cancellationToken)
            )
        : program.getSemanticDiagnostics(sourceFile, cancellationToken);

      tsDiagnostics.push(...tsDiagnosticsToRegister);
    });

    return createIssuesFromTsDiagnostics(tsDiagnostics);
  }

  public async getTsLintIssues(
    cancellationToken: CancellationToken
  ): Promise<Issue[]> {
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

    filesToLint.forEach(fileName => {
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
        throwIfIsInvalidSourceFileError(fileName, e);
      }
    });

    // set lints in files register
    linter.getResult().failures.forEach(lint => {
      const filePath = lint.getFileName();

      this.files.mutateData(filePath, data => {
        data.linted = true;
        data.tslints.push(lint);
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
      .reduce<tslint.RuleFailure[]>(
        (innerLints, filePath) =>
          innerLints.concat(this.files.getData(filePath).tslints),
        []
      );

    return createIssuesFromTsLintRuleFailures(lints);
  }

  public async getEsLintIssues(
    cancellationToken: CancellationToken
  ): Promise<Issue[]> {
    // select files to lint
    const filesToLint = this.files
      .keys()
      .filter(
        filePath =>
          !this.files.getData(filePath).linted &&
          !IncrementalChecker.isFileExcluded(filePath, this.linterExclusions)
      );

    const currentEsLintErrors = new Map<string, eslint.CLIEngine.LintReport>();
    filesToLint.forEach(fileName => {
      cancellationToken.throwIfCancellationRequested();

      const report = this.eslinter!.getReport(fileName);
      if (report !== undefined) {
        currentEsLintErrors.set(fileName, report);
      }
    });

    // set lints in files register
    for (const [filePath, lint] of currentEsLintErrors) {
      this.files.mutateData(filePath, data => {
        data.linted = true;
        data.eslints.push(lint);
      });
    }

    // set all files as linted
    this.files.keys().forEach(filePath => {
      this.files.mutateData(filePath, data => {
        data.linted = true;
      });
    });

    const reports = this.files
      .keys()
      .reduce<eslint.CLIEngine.LintReport[]>(
        (innerLints, filePath) =>
          innerLints.concat(this.files.getData(filePath).eslints),
        []
      );

    return createIssuesFromEsLintReports(reports);
  }
}
