interface Position {
  offset: number;
  line: number;
  column: number;
}

interface SourceLocation {
  start: Position;
  end: Position;
  source: string;
}

export interface SFCBlock {
  type: string;
  content: string;
  attrs: Record<string, string | true>;
  loc: SourceLocation;
  lang?: string;
  src?: string;
}

interface SFCDescriptor {
  filename: string;
  template: SFCBlock | null;
  script: SFCBlock | null;
  scriptSetup: SFCBlock | null;
  styles: SFCBlock[];
  customBlocks: SFCBlock[];
}

interface CompilerError extends SyntaxError {
  code: number;
  loc?: SourceLocation;
}

interface SFCParseResult {
  descriptor: SFCDescriptor;
  errors: CompilerError[];
}

interface SFCParserOptionsV3 {
  pad?: true | 'line' | 'space';
}

export interface VueTemplateCompilerV3 {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse(template: string, options?: SFCParserOptionsV3): SFCParseResult;
}
