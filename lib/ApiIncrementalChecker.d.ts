import * as ts from 'typescript';
import { RuleFailure } from 'tslint';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { CancellationToken } from './CancellationToken';
import { NormalizedMessage } from './NormalizedMessage';
export declare class ApiIncrementalChecker
  implements IncrementalCheckerInterface {
  private createNormalizedMessageFromDiagnostic;
  private createNormalizedMessageFromRuleFailure;
  private context;
  private linterConfigFile;
  private linterAutoFix;
  private linterConfig?;
  private linterConfigs;
  private readonly tsIncrementalCompiler;
  private linterExclusions;
  private currentLintErrors;
  private lastUpdatedFiles;
  private lastRemovedFiles;
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
    compilerOptions: ts.CompilerOptions,
    context: string,
    linterConfigFile: string | boolean,
    linterAutoFix: boolean,
    checkSyntacticErrors: boolean
  );
  private initLinterConfig;
  private getLinterConfig;
  private createLinter;
  hasLinter(): boolean;
  isFileExcluded(filePath: string): boolean;
  nextIteration(): void;
  getDiagnostics(
    _cancellationToken: CancellationToken
  ): Promise<NormalizedMessage[]>;
  getLints(_cancellationToken: CancellationToken): NormalizedMessage[];
  private emitFiles;
}
