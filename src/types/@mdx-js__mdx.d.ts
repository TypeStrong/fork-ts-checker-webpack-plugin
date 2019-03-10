declare module '@mdx-js/mdx' {
  const compiler: { sync(mdx: string, options?: Partial<MdxOptions>): string };
  export = compiler;
}
