class AbortError extends Error {
  constructor(message = 'Task aborted.') {
    super(message);
    this.name = 'AbortError';
  }

  static throwIfAborted(signal: AbortSignal | undefined) {
    if (signal?.aborted) {
      throw new AbortError();
    }
  }
}

export { AbortError };
