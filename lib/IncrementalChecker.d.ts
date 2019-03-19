import * as ts from 'typescript';
import { RuleFailure } from 'tslint';
import { NormalizedMessage } from './NormalizedMessage';
import { CancellationToken } from './CancellationToken';
import * as minimatch from 'minimatch';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
export declare class IncrementalChecker implements IncrementalCheckerInterface {
  private typescript;
  private createNormalizedMessageFromDiagnostic;
  private createNormalizedMessageFromRuleFailure;
  private programConfigFile;
  private compilerOptions;
  private context;
  private linterConfigFile;
  private linterAutoFix;
  private watchPaths;
  private workNumber;
  private workDivision;
  private checkSyntacticErrors;
  private vue;
  private linterConfigs;
  private files;
  private linter?;
  private linterConfig?;
  private linterExclusions;
  private program?;
  private programConfig?;
  private watcher?;
  private readonly hasFixedConfig;
  constructor(
    typescript: typeof ts,
    createNormalizedMessageFromDiagnostic: (
      diagnostic: ts.Diagnostic
    ) => NormalizedMessage,
    createNormalizedMessageFromRuleFailure: (
      ruleFailure: RuleFailure
    ) => NormalizedMessage,
    programConfigFile: string,
    compilerOptions: object,
    context: string,
    linterConfigFile: string | boolean,
    linterAutoFix: boolean,
    watchPaths: string[],
    workNumber?: number,
    workDivision?: number,
    checkSyntacticErrors?: boolean,
    vue?: boolean
  );
  static loadProgramConfig(
    typescript: typeof ts,
    configFile: string,
    compilerOptions: object
  ): ts.ParsedCommandLine;
  private getLinterConfig;
  private static createProgram;
  private createLinter;
  hasLinter(): boolean;
  static isFileExcluded(
    filePath: string,
    linterExclusions: minimatch.IMinimatch[]
  ): boolean;
  nextIteration(): void;
  private loadVueProgram;
  private loadDefaultProgram;
  getDiagnostics(
    cancellationToken: CancellationToken
  ): Promise<NormalizedMessage[]>;
  getLints(cancellationToken: CancellationToken): NormalizedMessage[];
  emitFiles(): void;
}
