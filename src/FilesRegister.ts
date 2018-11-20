import * as ts from 'typescript';
import { RuleFailure } from 'tslint';

export interface DataShape {
  source?: ts.SourceFile;
  linted: boolean;
  lints: RuleFailure[];
}

export class FilesRegister {
  private files: { [filePath: string]: { mtime?: number; data: DataShape } };

  constructor(private dataFactory: (_data?: DataShape) => DataShape) {
    this.files = {};
    this.dataFactory = dataFactory;
  }

  public keys() {
    return Object.keys(this.files);
  }

  public add(filePath: string) {
    this.files[filePath] = {
      mtime: undefined,
      data: this.dataFactory(undefined)
    };
  }

  public remove(filePath: string) {
    if (this.has(filePath)) {
      delete this.files[filePath];
    }
  }

  public has(filePath: string) {
    return this.files.hasOwnProperty(filePath);
  }

  public get(filePath: string) {
    if (!this.has(filePath)) {
      throw new Error('File "' + filePath + '" not found in register.');
    }

    return this.files[filePath];
  }

  public ensure(filePath: string) {
    if (!this.has(filePath)) {
      this.add(filePath);
    }
  }

  public getData(filePath: string) {
    return this.get(filePath).data;
  }

  public mutateData(filePath: string, mutator: (data: DataShape) => void) {
    this.ensure(filePath);

    mutator(this.files[filePath].data);
  }

  public getMtime(filePath: string) {
    return this.get(filePath).mtime;
  }

  public setMtime(filePath: string, mtime: number) {
    this.ensure(filePath);

    if (this.files[filePath].mtime !== mtime) {
      this.files[filePath].mtime = mtime;
      // file has been changed - we have to reset data
      this.files[filePath].data = this.dataFactory(this.files[filePath].data);
    }
  }
}
