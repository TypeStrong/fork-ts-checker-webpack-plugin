import * as ts from 'typescript';

import { CancellationToken } from '../CancellationToken';

class TypeScriptCancellationToken
  implements CancellationToken, ts.CancellationToken {
  constructor(
    private readonly typescript: typeof ts,
    private readonly token: CancellationToken
  ) {}

  isCancellationRequested() {
    return this.token.isCancellationRequested();
  }

  requestCancellation() {
    return this.token.requestCancellation();
  }

  cleanupCancellation() {
    return this.token.cleanupCancellation();
  }

  throwIfCancellationRequested() {
    if (this.token.isCancellationRequested()) {
      throw new this.typescript.OperationCanceledException();
    }
  }
}

export { TypeScriptCancellationToken };
