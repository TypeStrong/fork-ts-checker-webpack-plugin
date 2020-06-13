import { RpcMessagePortClosedError } from '../../error/RpcMessagePortClosedError';

class RpcIpcMessagePortClosedError extends RpcMessagePortClosedError {
  constructor(
    message: string,
    readonly code?: string | number | null,
    readonly signal?: string | null
  ) {
    super(message);
    this.name = 'RpcIpcMessagePortClosedError';
  }
}

export { RpcIpcMessagePortClosedError };
