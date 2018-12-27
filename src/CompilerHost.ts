import * as ts from 'typescript';
import { FilesWatcher } from './FilesWatcher';
import * as fs from 'fs';
import { Dictionary } from 'typescript-collections';

export class CompilerHost
  implements
    ts.WatchCompilerHostOfConfigFile<ts.SemanticDiagnosticsBuilderProgram> {
  private _changed = new Map<{ path: string }, { stats: fs.Stats }>();
  private _removed = new Set<{ path: string }>();

  private _directoryWatchers = new Dictionary<
    { path: string; recursive: boolean },
    { callback: ts.DirectoryWatcherCallback }
  >(key => key.path + key.recursive);
  private _fileWatchers = new Dictionary<
    { path: string },
    { callback: ts.FileWatcherCallback }
  >(key => key.path);

  constructor() {
    const watchExtensions = ['.ts', '.tsx'];
    const watcher = new FilesWatcher(this.watchPaths, watchExtensions);

    watcher.on('change', (filePath: string, stats: fs.Stats) => {
      this._changed.set({ path: filePath }, { stats });
    });
    watcher.on('unlink', (filePath: string) => {
      this._removed.add({ path: filePath });
    });
    watcher.watch();
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
    const key = { path, recursive: recursive === true };
    this._directoryWatchers.setValue(key, { callback });
    return {
      close: () => {
        this._directoryWatchers.remove(key);
      }
    };
  }

  public watchFile(
    path: string,
    callback: ts.FileWatcherCallback,
    _pollingInterval?: number
  ): ts.FileWatcher {
    const key = { path };
    this._fileWatchers.setValue(key, { callback });
    return {
      close: () => {
        this._fileWatchers.remove(key);
      }
    };
  }

  public fileExists(path: string): boolean {
    return ts.sys.fileExists(path);
  }

  public readFile(path: string, encoding?: string) {
    return ts.sys.readFile(path, encoding);
  }

  public directoryExists(path: string) {
    return ts.sys.directoryExists(path);
  }

  public getDirectories(path: string): string[] {
    return ts.sys.getDirectories(path);
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

  public fireWatchEvents() {
    let anythingFired = false;
    for (const [key] of this._changed) {
      const watcher = this._fileWatchers.getValue({ path: key.path });
      if (watcher) {
        anythingFired = true;
        watcher.callback(key.path, ts.FileWatcherEventKind.Changed);
      }
    }

    // todo support for directories watching

    this._removed.clear();
    this._changed.clear();
    return anythingFired;
  }

  public configFileName: string;
  public createProgram: ts.CreateProgram<ts.SemanticDiagnosticsBuilderProgram>;
  public optionsToExtend: ts.CompilerOptions;

  public afterProgramCreate(
    program: ts.SemanticDiagnosticsBuilderProgram
  ): void {
    // do nothing
  }

  public createHash(data: string): string {
    return '';
  }

  public getCurrentDirectory(): string {
    return '';
  }

  public getDefaultLibFileName(options: ts.CompilerOptions): string {
    return '';
  }

  public getDefaultLibLocation(): string {
    return '';
  }

  public getEnvironmentVariable(name: string): string | undefined {
    return undefined;
  }

  public getNewLine(): string {
    return '';
  }

  public realpath(path: string): string {
    return ts.sys.realpath!(path);
  }

  public trace(s: string): void {
    // do nothing
  }

  public useCaseSensitiveFileNames(): boolean {
    return false;
  }

  public onUnRecoverableConfigFileDiagnostic(_diag: ts.Diagnostic) {
    // do nothing
  }
}
