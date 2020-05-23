// copy eslint types as installation of eslint package is optional
export interface LintMessage {
  column: number;
  line: number;
  endColumn?: number;
  endLine?: number;
  ruleId: string | null;
  message: string;
  nodeType: string;
  fatal?: true;
  severity: 0 | 1 | 2;
  fix?: {
    range: [number, number];
    text: string;
  };
  source: string | null;
}

export interface LintResult {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  output?: string;
  source?: string;
}

export interface LintReport {
  results: LintResult[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

export interface Options {
  fix?: boolean;

  // The rest of the properties are not specified here because they are not
  // directly used by this package and are instead just passed to eslint.
  // We do this in order to avoid a dependency on @types/eslint (since the use
  // of eslint is optional) and to avoid copying types from @types/eslint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
