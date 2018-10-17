import * as ts from 'typescript';

interface DataShape {
  source: ts.SourceFile;
  linted: boolean;
  lints: any[];
}

export class FilesRegister {
  files: { [filePath: string]: { mtime: number; data: DataShape } };
  dataFactory: (_data?: any) => DataShape; // It doesn't seem that the _data parameter is ever used?

  constructor(dataFactory: (_data?: any) => DataShape) {
    this.files = {};
    this.dataFactory = dataFactory;
  }

  keys() {
    return Object.keys(this.files);
  }

  add(filePath: string) {
    this.files[filePath] = {
      mtime: undefined,
      data: this.dataFactory(undefined)
    };
  }

  remove(filePath: string) {
    if (this.has(filePath)) {
      delete this.files[filePath];
    }
  }

  has(filePath: string) {
    return this.files.hasOwnProperty(filePath);
  }

  get(filePath: string) {
    if (!this.has(filePath)) {
      throw new Error('File "' + filePath + '" not found in register.');
    }

    return this.files[filePath];
  }

  ensure(filePath: string) {
    if (!this.has(filePath)) {
      this.add(filePath);
    }
  }

  getData(filePath: string) {
    return this.get(filePath).data;
  }

  mutateData(filePath: string, mutator: (data: DataShape) => void) {
    this.ensure(filePath);

    mutator(this.files[filePath].data);
  }

  getMtime(filePath: string) {
    return this.get(filePath).mtime;
  }

  setMtime(filePath: string, mtime: number) {
    this.ensure(filePath);

    if (this.files[filePath].mtime !== mtime) {
      this.files[filePath].mtime = mtime;
      // file has been changed - we have to reset data
      this.files[filePath].data = this.dataFactory(this.files[filePath].data);
    }
  }
}
