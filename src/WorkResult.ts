import { Message } from './Message';

export class WorkResult {
  private workResult: {
    [key: string]: Message;
  } = {};

  constructor(private workDomain: number[]) {
  }

  public supports(workName: number) {
    return this.workDomain.includes(workName);
  }

  public set(workName: number, result: Message) {
    if (!this.supports(workName)) {
      throw new Error(
        'Cannot set result - work "' + workName + '" is not supported.'
      );
    }

    this.workResult[workName] = result;
  }

  public has(workName: number) {
    return this.supports(workName) && undefined !== this.workResult[workName];
  }

  public get(workName: number) {
    if (!this.supports(workName)) {
      throw new Error(
        'Cannot get result - work "' + workName + '" is not supported.'
      );
    }

    return this.workResult[workName];
  }

  public hasAll() {
    return this.workDomain.every(key => this.has(key));
  }

  public clear() {
    this.workResult = {};
  }

  public reduce(reducer: (m1: Message, m2: Message) => Message, initial: Message) {
    return this.workDomain.reduce((reduced, workName) => {
      return reducer(reduced, this.workResult[workName]);
    }, initial);
  }
}
