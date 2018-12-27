import * as ts from 'typescript';
import { LinkedList } from './LinkedList';

interface DirectoryWatchDelaySlot {
  events: { fileName: string }[];
  callback: ts.DirectoryWatcherCallback;
}

interface FileWatchDelaySlot {
  events: { fileName: string; eventKind: ts.FileWatcherEventKind }[];
  callback: ts.FileWatcherCallback;
}

export class CompilerHost
  implements
    ts.WatchCompilerHostOfConfigFile<
      ts.EmitAndSemanticDiagnosticsBuilderProgram
    > {
  public configFileName: string;
  public optionsToExtend: ts.CompilerOptions;

  // intercept all watch events and collect them until we get notification to start compilation
  private directoryWatchers = new LinkedList<DirectoryWatchDelaySlot>();
  private fileWatchers = new LinkedList<FileWatchDelaySlot>();

  private _gatheredDiagnostic: ts.Diagnostic[] = [];
  private afterCompile = () => {
    /* do nothing */
  };

  private readonly tsHost: ts.WatchCompilerHostOfConfigFile<
    ts.EmitAndSemanticDiagnosticsBuilderProgram
  >;
  private lastProcessing?: Promise<ts.Diagnostic[]>;

  private compilationStarted = false;

  constructor(programConfigFile: string, compilerOptions: ts.CompilerOptions) {
    this.tsHost = ts.createWatchCompilerHost(
      programConfigFile,
      compilerOptions,
      ts.sys,
      ts.createEmitAndSemanticDiagnosticsBuilderProgram,
      (diag: ts.Diagnostic) => {
        this._gatheredDiagnostic.push(diag);
      },
      () => {
        this.compilationStarted = true;
      }
    );

    this.configFileName = this.tsHost.configFileName;
    this.optionsToExtend = this.tsHost.optionsToExtend || {};
  }

  public async processChanges(): Promise<ts.Diagnostic[]> {
    if (!this.lastProcessing) {
      const initialCompile = new Promise<ts.Diagnostic[]>(resolve => {
        this.afterCompile = () => {
          resolve(this._gatheredDiagnostic);
          this.afterCompile = () => {
            /* do nothing */
          };
          this.compilationStarted = false;
        };
      });
      this.lastProcessing = initialCompile;
      ts.createWatchProgram(this);
      return initialCompile;
    }

    // since we do not have a way to pass cancellation token to typescript,
    // we just wait until previous compilation finishes.
    await this.lastProcessing;

    this._gatheredDiagnostic.length = 0;
    const result = new Promise<ts.Diagnostic[]>(resolve => {
      this.afterCompile = () => {
        resolve(this._gatheredDiagnostic);
        this.afterCompile = () => {
          /* do nothing */
        };
        this.compilationStarted = false;
      };
    });
    this.lastProcessing = result;

    this.directoryWatchers.forEach(item => {
      for (const e of item.events) {
        item.callback(e.fileName);
      }
      item.events.length = 0;
    });

    this.fileWatchers.forEach(item => {
      for (const e of item.events) {
        item.callback(e.fileName, e.eventKind);
      }
      item.events.length = 0;
    });

    // if the files are not relevant to typescript it may choose not to compile
    // in this case we need to trigger promise resolution from here
    if (!this.compilationStarted) {
      this.afterCompile();
    }

    return result;
  }

  public setTimeout(
    callback: (...args: any[]) => void,
    _ms: number,
    ...args: any[]
  ): any {
    // this is only called from watch program to wait until all files are updated
    // since we notify it of update when they are already updated, we do not need to waste additional time
    // this could be fixed nicer, but 250 is hardcoded in watch.ts in TypeScript
    return ts.sys.setTimeout!(callback, 1, args);
  }

  public clearTimeout(timeoutId: any): void {
    ts.sys.clearTimeout!(timeoutId);
  }

  public onWatchStatusChange(
    _diagnostic: ts.Diagnostic,
    _newLine: string,
    _options: ts.CompilerOptions
  ): void {
    // do nothing
  }

  public watchDirectory(
    path: string,
    callback: ts.DirectoryWatcherCallback,
    recursive?: boolean
  ): ts.FileWatcher {
    const slot: DirectoryWatchDelaySlot = { callback, events: [] };
    const node = this.directoryWatchers.add(slot);
    this.tsHost.watchDirectory(
      path,
      fileName => {
        slot.events.push({ fileName });
      },
      recursive
    );
    return {
      close: () => {
        node.detachSelf();
      }
    };
  }

  public watchFile(
    path: string,
    callback: ts.FileWatcherCallback,
    _pollingInterval?: number
  ): ts.FileWatcher {
    const slot: FileWatchDelaySlot = { callback, events: [] };
    const node = this.fileWatchers.add(slot);
    this.tsHost.watchFile(
      path,
      (fileName, eventKind) => {
        slot.events.push({ fileName, eventKind });
      },
      _pollingInterval
    );
    return {
      close: () => {
        node.detachSelf();
      }
    };
  }

  public fileExists(path: string): boolean {
    return this.tsHost.fileExists(path);
  }

  public readFile(path: string, encoding?: string) {
    return this.tsHost.readFile(path, encoding);
  }

  public directoryExists(path: string): boolean {
    return (
      (this.tsHost.directoryExists && this.tsHost.directoryExists(path)) ||
      false
    );
  }

  public getDirectories(path: string): string[] {
    return (
      (this.tsHost.getDirectories && this.tsHost.getDirectories(path)) || []
    );
  }

  public readDirectory(
    path: string,
    extensions?: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>,
    include?: ReadonlyArray<string>,
    depth?: number
  ): string[] {
    return ts.sys.readDirectory(path, extensions, exclude, include, depth);
  }

  public createProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram;

  public getCurrentDirectory(): string {
    return this.tsHost.getCurrentDirectory();
  }

  public getDefaultLibFileName(options: ts.CompilerOptions): string {
    return this.tsHost.getDefaultLibFileName(options);
  }

  public getEnvironmentVariable(name: string): string | undefined {
    return (
      this.tsHost.getEnvironmentVariable &&
      this.tsHost.getEnvironmentVariable(name)
    );
  }

  public getNewLine(): string {
    return this.tsHost.getNewLine();
  }

  public realpath(path: string): string {
    return this.tsHost.realpath!(path);
  }

  public trace(s: string): void {
    if (this.tsHost.trace) {
      this.tsHost.trace(s);
    }
  }

  public useCaseSensitiveFileNames(): boolean {
    return false;
  }

  public onUnRecoverableConfigFileDiagnostic(_diag: ts.Diagnostic) {
    // do nothing
  }

  public afterProgramCreate(
    program: ts.EmitAndSemanticDiagnosticsBuilderProgram
  ): void {
    // all actual diagnostics happens here
    this.tsHost.afterProgramCreate!(program);
    this.afterCompile();
  }

  // the functions below are use internally by typescript. we cannot use non-emitting version of incremental watching API
  // because it is
  // - much slower for some reason,
  // - writes files anyway (o_O)
  // - has different way of providing diagnostics. (with this version we can at least reliably get it from afterProgramCreate)
  public createDirectory(_path: string): void {
    // pretend everything was ok
  }
  public writeFile(
    _path: string,
    _data: string,
    _writeByteOrderMark?: boolean
  ): void {
    // pretend everything was ok
  }
  public onCachedDirectoryStructureHostCreate?(_host: any): void {
    // pretend everything was ok
  }
}
