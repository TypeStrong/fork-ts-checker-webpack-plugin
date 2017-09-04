import Message from './Message';

class WorkResult {
  workResult: {};
  workDomain: any[];

  constructor(workDomain: any[]) {
    this.workResult = {};
    this.workDomain = workDomain;
  }

  supports(workName: string) {
    return -1 !== this.workDomain.indexOf(workName);
  }

  set(workName: string, result: any) {
    if (!this.supports(workName)) {
      throw new Error('Cannot set result - work "' + workName + '" is not supported.');
    }

    this.workResult[workName] = result;
  }

  has(workName: string) {
    return this.supports(workName) && undefined !== this.workResult[workName];
  }

  get(workName: string) {
    if (!this.supports(workName)) {
      throw new Error('Cannot get result - work "' + workName + '" is not supported.');
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

export = WorkResult;
