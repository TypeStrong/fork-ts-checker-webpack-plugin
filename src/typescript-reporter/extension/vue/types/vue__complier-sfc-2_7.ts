export interface StartOfSourceMap {
  file?: string;
  sourceRoot?: string;
}
export interface RawSourceMap extends StartOfSourceMap {
  version: string;
  sources: string[];
  names: string[];
  sourcesContent?: string[];
  mappings: string;
}

export interface SFCCustomBlock {
  type: string;
  content: string;
  attrs: { [key: string]: string | true };
  start: number;
  end: number;
  src?: string;
  map?: RawSourceMap;
}

export interface SFCScriptBlock extends SFCBlock {
  type: 'script';
  setup?: string | boolean;
  /**
   * import('\@babel/types').Statement
   */
  scriptAst?: any[];
  /**
   * import('\@babel/types').Statement
   */
  scriptSetupAst?: any[];
}

export interface SFCBlock extends SFCCustomBlock {
  lang?: string;
  scoped?: boolean;
  module?: string | boolean;
}
export interface SFCDescriptor {
  source: string;
  filename: string;
  template: SFCBlock | null;
  script: SFCScriptBlock | null;
  scriptSetup: SFCScriptBlock | null;
  styles: SFCBlock[];
  customBlocks: SFCCustomBlock[];
  cssVars: string[];
}
export interface SFCParseOptions {
  source: string;
  filename?: string;
  sourceRoot?: string;
  sourceMap?: boolean;
  /**
   * @deprecated use `sourceMap` instead.
   */
  needMap?: boolean;
}

export interface VueTemplateCompilerV2dot7 {
  parse(options?: SFCParseOptions): SFCDescriptor;
}
