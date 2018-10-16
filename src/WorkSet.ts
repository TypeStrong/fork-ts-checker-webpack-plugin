import * as ts from 'typescript';

export class WorkSet {
  workDomain: ReadonlyArray<ts.SourceFile> | string[];
  workNumber: number;
  workDivision: number;
  workSize: number;
  workBegin: number;
  workEnd: number;

  constructor(
    workDomain: ReadonlyArray<ts.SourceFile> | string[],
    workNumber: number,
    workDivision: number
  ) {
    this.workDomain = workDomain;
    this.workNumber = workNumber;
    this.workDivision = workDivision;
    this.workSize = Math.floor(this.workDomain.length / this.workDivision);
    this.workBegin = this.workNumber * this.workSize;
    this.workEnd = this.workBegin + this.workSize;

    // be sure that we will process all work for odd workSize.
    if (this.workNumber === this.workDivision - 1) {
      this.workEnd = this.workDomain.length;
    }
  }

  forEach(callback: (workDomainItem: any, index: number) => void) {
    for (let i = this.workBegin; i < this.workEnd; ++i) {
      callback(this.workDomain[i], i);
    }
  }
}
