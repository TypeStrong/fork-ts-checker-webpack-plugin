class OperationCancelledError extends Error {
  readonly cancelled = true;

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, OperationCancelledError.prototype);
  }
}

export { OperationCancelledError };
