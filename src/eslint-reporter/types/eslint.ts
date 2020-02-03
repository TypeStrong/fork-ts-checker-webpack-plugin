// copy minimal eslint types as installation of eslint package is optional
export interface LintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
  endColumn?: number;
  endLine?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface LintResult {
  filePath: string;
  messages: LintMessage[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface LintReport {
  results: LintResult[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface CLIEngine {
  version: string;
  executeOnFiles(filesPatterns: string[]): LintReport;
  resolveFileGlobPatterns(filesPatterns: string[]): string[];
}
