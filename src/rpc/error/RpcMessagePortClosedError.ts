class RpcMessagePortClosedError extends Error {
  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, RpcMessagePortClosedError.prototype);
  }
}

export { RpcMessagePortClosedError };
