declare module 'unixify' {
  function unixify(filePath: string, stripTrailingSlash?: boolean): string;
  export = unixify;
}
