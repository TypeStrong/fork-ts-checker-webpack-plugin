// provide done callback because our promise chain is a little bit complicated
type Task<T> = (done: () => void) => Promise<T>;

interface Pool {
  submit<T>(task: Task<T>): Promise<T>;
  size: number;
  readonly pending: number;
  readonly drained: Promise<void>;
}

function createPool(size: number): Pool {
  let pendingPromises: Promise<unknown>[] = [];

  const pool = {
    async submit<T>(task: Task<T>): Promise<T> {
      while (pendingPromises.length >= pool.size) {
        await Promise.race(pendingPromises).catch(() => undefined);
      }

      let resolve: (result: T) => void;
      let reject: (error: Error) => void;
      const taskPromise = new Promise<T>((taskResolve, taskReject) => {
        resolve = taskResolve;
        reject = taskReject;
      });

      const donePromise = new Promise((doneResolve) => {
        task(() => {
          doneResolve(undefined);
          pendingPromises = pendingPromises.filter(
            (pendingPromise) => pendingPromise !== donePromise
          );
        })
          .then(resolve)
          .catch(reject);
      });
      pendingPromises.push(donePromise);

      return taskPromise;
    },
    size,
    get pending() {
      return pendingPromises.length;
    },
    get drained() {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise<void>(async (resolve) => {
        while (pendingPromises.length > 0) {
          await Promise.race(pendingPromises).catch(() => undefined);
        }
        resolve(undefined);
      });
    },
  };

  return pool;
}

export { Pool, createPool };
