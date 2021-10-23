// provide done callback because our promise chain is a little bit complicated
type Task<T> = () => Promise<T>;

interface Pool {
  submit<T>(task: Task<T>): Promise<T>;
  size: number;
  readonly pending: number;
  readonly drained: Promise<void>;
}

function createPool(size: number): Pool {
  let pendingTasks: Promise<unknown>[] = [];

  const pool = {
    async submit<T>(task: Task<T>): Promise<T> {
      while (pendingTasks.length >= pool.size) {
        await Promise.race(pendingTasks).catch(() => undefined);
      }

      const taskPromise = task().finally(() => {
        pendingTasks = pendingTasks.filter((pendingTask) => pendingTask !== taskPromise);
      });
      pendingTasks.push(taskPromise);

      return taskPromise;
    },
    size,
    get pending() {
      return pendingTasks.length;
    },
    get drained() {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise<void>(async (resolve) => {
        while (pendingTasks.length > 0) {
          await Promise.race(pendingTasks).catch(() => undefined);
        }
        resolve(undefined);
      });
    },
  };

  return pool;
}

export { Pool, createPool };
