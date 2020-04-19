class OperationCancelledError extends Error {
  readonly cancelled = true;
}

export { OperationCancelledError };
