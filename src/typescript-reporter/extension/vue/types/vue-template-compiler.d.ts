/**
 * This declaration is copied from https://github.com/vuejs/vue/pull/7918
 * which may included vue-template-compiler v2.6.0.
 */
interface SFCParserOptions {
  pad?: true | 'line' | 'space';
}

export interface SFCBlock {
  type: string;
  content: string;
  attrs: Record<string, string>;
  start?: number;
  end?: number;
  lang?: string;
  src?: string;
  scoped?: boolean;
  module?: string | boolean;
}

export interface SFCDescriptor {
  template: SFCBlock | undefined;
  script: SFCBlock | undefined;
  styles: SFCBlock[];
  customBlocks: SFCBlock[];
}

export interface VueTemplateCompiler {
  parseComponent(file: string, options?: SFCParserOptions): SFCDescriptor;
}
