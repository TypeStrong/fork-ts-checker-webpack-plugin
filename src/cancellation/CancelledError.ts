class CancelledError extends Error {
  constructor(message = 'Operation has been cancelled.') {
    super(message);

    Object.setPrototypeOf(this, CancelledError.prototype);
  }
}

export { CancelledError };
