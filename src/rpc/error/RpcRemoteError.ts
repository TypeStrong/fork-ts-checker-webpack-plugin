class RpcRemoteError extends Error {
  constructor(message: string, readonly stack?: string) {
    super(message);
  }

  toString() {
    if (this.stack) {
      return [this.message, this.stack].join('\n');
    } else {
      return this.message;
    }
  }
}

export { RpcRemoteError };
