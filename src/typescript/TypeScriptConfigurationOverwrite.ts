interface TypeScriptConfigurationOverwrite {
  extends?: string;
  // eslint-disable-next-line
  compilerOptions?: any;
  include?: string[];
  exclude?: string[];
  files?: string[];
  references?: { path: string; prepend?: boolean }[];
}

export { TypeScriptConfigurationOverwrite };
