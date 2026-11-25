interface TypeScriptConfigOverwrite {
  extends?: string | string[];
  // eslint-disable-next-line
  compilerOptions?: any;
  include?: string[];
  exclude?: string[];
  files?: string[];
  references?: { path: string; prepend?: boolean }[];
}

export { TypeScriptConfigOverwrite };
