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
  allowInlineConfig?: boolean;
  baseConfig?: false | { [name: string]: any };
  cache?: boolean;
  cacheFile?: string;
  cacheLocation?: string;
  configFile?: string;
  cwd?: string;
  envs?: string[];
  errorOnUnmatchedPattern?: boolean;
  extensions?: string[];
  fix?: boolean;
  globals?: string[];
  ignore?: boolean;
  ignorePath?: string;
  ignorePattern?: string | string[];
  useEslintrc?: boolean;
  parser?: string;
  parserOptions?: ParserOptions;
  plugins?: string[];
  resolvePluginsRelativeTo?: string;
  rules?: {
    [name: string]: RuleLevel | RuleLevelAndOptions;
  };
  rulePaths?: string[];
  reportUnusedDisableDirectives?: boolean;
}

interface ParserOptions {
  ecmaVersion?:
    | 3
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 2015
    | 2016
    | 2017
    | 2018
    | 2019
    | 2020;
  sourceType?: 'script' | 'module';
  ecmaFeatures?: {
    globalReturn?: boolean;
    impliedStrict?: boolean;
    jsx?: boolean;
    experimentalObjectRestSpread?: boolean;
    [key: string]: any;
  };
  [key: string]: any;
}

type RuleLevel = Severity | 'off' | 'warn' | 'error';
type Severity = 0 | 1 | 2;

interface RuleLevelAndOptions extends Array<any> {
  0: RuleLevel;
}
