import { RpcMessagePortClosedError } from '../../error/RpcMessagePortClosedError';

class RpcIpcMessagePortClosedError extends RpcMessagePortClosedError {
  constructor(
    message: string,
    readonly code: string | number | null,
    readonly signal: string | null
  ) {
    super(message);

    Object.setPrototypeOf(this, RpcIpcMessagePortClosedError.prototype);
  }
}

export { RpcIpcMessagePortClosedError };
