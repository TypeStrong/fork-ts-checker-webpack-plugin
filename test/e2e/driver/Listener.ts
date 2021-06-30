interface Listener<TValue = void> {
  resolve(value: TValue): void;
  reject(error: unknown): void;
}

interface QueuedListener<TValue = void> extends Listener<TValue> {
  apply(listener: Listener<TValue>): void;
  resolved: TValue | undefined;
  rejected: unknown | undefined;
  status: 'pending' | 'resolved' | 'rejected';
}

function createQueuedListener<TValue = void>(): QueuedListener<TValue> {
  let resolve: (value: TValue) => void | undefined;
  let reject: (error: unknown) => void | undefined;

  const queuedListener: QueuedListener<TValue> = {
    resolve(value) {
      if (queuedListener.status === 'pending') {
        queuedListener.resolved = value;
        queuedListener.status = 'resolved';

        if (resolve) {
          resolve(value);
        }
      }
    },
    reject(error) {
      if (queuedListener.status === 'pending') {
        queuedListener.rejected = error;
        queuedListener.status = 'rejected';

        if (reject) {
          reject(error);
        }
      }
    },
    apply(listener) {
      switch (queuedListener.status) {
        case 'resolved':
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          listener.resolve(queuedListener.resolved!);
          break;
        case 'rejected':
          listener.reject(queuedListener.rejected);
          break;
        case 'pending':
          resolve = listener.resolve;
          reject = listener.reject;
          break;
      }
    },
    resolved: undefined,
    rejected: undefined,
    status: 'pending',
  };

  return queuedListener;
}

export { Listener, QueuedListener, createQueuedListener };
