import * as ts from 'typescript';

export class WorkSet {
  private workSize: number;
  private workBegin: number;
  private workEnd: number;

  constructor(
    private workDomain: ReadonlyArray<ts.SourceFile> | string[],
    private workNumber: number,
    private workDivision: number
  ) {
    this.workSize = Math.floor(this.workDomain.length / this.workDivision);
    this.workBegin = this.workNumber * this.workSize;
    this.workEnd = this.workBegin + this.workSize;

    // be sure that we will process all work for odd workSize.
    if (this.workNumber === this.workDivision - 1) {
      this.workEnd = this.workDomain.length;
    }
  }

  public forEach(callback: (workDomainItem: any, index: number) => void) {
    for (let i = this.workBegin; i < this.workEnd; ++i) {
      callback(this.workDomain[i], i);
    }
  }
}
