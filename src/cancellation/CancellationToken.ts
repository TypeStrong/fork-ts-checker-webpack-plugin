interface CancellationToken {
  isCancellationRequested(): boolean;
  requestCancellation(): void;
  cleanupCancellation(): void;
}

export { CancellationToken };
