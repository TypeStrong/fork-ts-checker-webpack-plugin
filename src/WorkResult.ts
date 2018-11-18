import { Message } from './Message';

export class WorkResult {
  workResult: {
    [key: string]: Message;
  } = {};
  workDomain: number[];

  constructor(workDomain: number[]) {
    this.workDomain = workDomain;
  }

  supports(workName: number) {
    return -1 !== this.workDomain.indexOf(workName);
  }

  set(workName: number, result: Message) {
    if (!this.supports(workName)) {
      throw new Error(
        'Cannot set result - work "' + workName + '" is not supported.'
      );
    }

    this.workResult[workName] = result;
  }

  has(workName: number) {
    return this.supports(workName) && undefined !== this.workResult[workName];
  }

  get(workName: number) {
    if (!this.supports(workName)) {
      throw new Error(
        'Cannot get result - work "' + workName + '" is not supported.'
      );
    }

    return this.workResult[workName];
  }

  hasAll() {
    return this.workDomain.every(key => this.has(key));
  }

  clear() {
    this.workResult = {};
  }

  reduce(reducer: (m1: Message, m2: Message) => Message, initial: Message) {
    return this.workDomain.reduce((reduced, workName) => {
      return reducer(reduced, this.workResult[workName]);
    }, initial);
  }
}
