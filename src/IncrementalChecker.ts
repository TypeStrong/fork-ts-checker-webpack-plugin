import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript'; // Imported for types alone; actual requires take place in methods below

import { FilesRegister } from './FilesRegister';
import { CancellationToken } from './CancellationToken';
import {
  ResolveModuleName,
  ResolveTypeReferenceDirective,
  makeResolutionFunctions
} from './resolution';
import { VueProgram } from './VueProgram';
import {
  IncrementalCheckerInterface,
  IncrementalCheckerParams
} from './IncrementalCheckerInterface';
import { createEslinter } from './createEslinter';
import { VueOptions } from './types/vue-options';
import {
  Issue,
  createIssuesFromEsLintReports,
  createIssuesFromTsDiagnostics
} from './issue';
import { LintReport } from './types/eslint';

export class IncrementalChecker implements IncrementalCheckerInterface {
  private files = new FilesRegister(() => ({
    // data shape
    source: undefined,
    linted: false,
    eslints: []
  }));

  protected program?: ts.Program;
  protected programConfig?: ts.ParsedCommandLine;

  private readonly typescript: typeof ts;
  private readonly programConfigFile: string;
  private readonly compilerOptions: object;
  private readonly eslinter: ReturnType<typeof createEslinter> | undefined;
  private readonly vue: VueOptions;
  private readonly checkSyntacticErrors: boolean;
  private readonly resolveModuleName: ResolveModuleName | undefined;
  private readonly resolveTypeReferenceDirective:
    | ResolveTypeReferenceDirective
    | undefined;

  constructor({
    typescript,
    programConfigFile,
    compilerOptions,
    eslinter,
    vue,
    checkSyntacticErrors = false,
    resolveModuleName,
    resolveTypeReferenceDirective
  }: IncrementalCheckerParams) {
    this.typescript = typescript;
    this.programConfigFile = programConfigFile;
    this.compilerOptions = compilerOptions;
    this.eslinter = eslinter;
    this.vue = vue;
    this.checkSyntacticErrors = checkSyntacticErrors;
    this.resolveModuleName = resolveModuleName;
    this.resolveTypeReferenceDirective = resolveTypeReferenceDirective;
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

  private static createProgram(
    typescript: typeof ts,
    programConfig: ts.ParsedCommandLine,
    files: FilesRegister,
    oldProgram: ts.Program | undefined,
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

  public hasEsLinter(): boolean {
    return this.eslinter !== undefined;
  }

  public static isFileExcluded(filePath: string): boolean {
    return filePath.endsWith('.d.ts');
  }

  public nextIteration() {
    this.program = this.vue.enabled
      ? this.loadVueProgram(this.vue)
      : this.loadDefaultProgram();
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
      this.program,
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
      this.program,
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

    return createIssuesFromTsDiagnostics(tsDiagnostics, this.typescript);
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
          !IncrementalChecker.isFileExcluded(filePath)
      );

    const currentEsLintErrors = new Map<string, LintReport>();
    filesToLint.forEach(fileName => {
      cancellationToken.throwIfCancellationRequested();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const report = this.eslinter!.getReport(fileName);
      if (report !== undefined) {
        currentEsLintErrors.set(fileName, report);
      }
    });

    // set lints in files register
    currentEsLintErrors.forEach((lint, filePath) => {
      this.files.mutateData(filePath, data => {
        data.linted = true;
        data.eslints.push(lint);
      });
    });

    // set all files as linted
    this.files.keys().forEach(filePath => {
      this.files.mutateData(filePath, data => {
        data.linted = true;
      });
    });

    const reports = this.files
      .keys()
      .reduce<LintReport[]>(
        (innerLints, filePath) =>
          innerLints.concat(this.files.getData(filePath).eslints),
        []
      );

    return createIssuesFromEsLintReports(reports);
  }
}
