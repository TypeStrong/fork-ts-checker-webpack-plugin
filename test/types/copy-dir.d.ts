declare module 'copy-dir' {
  const copydir: {
    (from: string, to: string, callback: (err: Error) => void): void;
    (
      from: string,
      to: string,
      filter: Function,
      callback: (err: Error) => void
    ): void;
    sync(from: string, to: string, filter?: Function): void;
  };
  export = copydir;
}
