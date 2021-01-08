import { createPool } from 'lib/utils/async/pool';

describe('createPool', () => {
  it('creates new pool', () => {
    const pool = createPool(10);
    expect(pool).toBeDefined();
    expect(pool.size).toEqual(10);
    expect(pool.pending).toEqual(0);
    expect(pool.submit).toBeInstanceOf(Function);
  });

  it('limits concurrency', async () => {
    const pool = createPool(2);
    const task = jest.fn(async (done: () => void) => {
      setTimeout(done, 100);
    });

    pool.submit(task);
    pool.submit(task);
    pool.submit(task);
    pool.submit(task);
    pool.submit(task);

    expect(task).toHaveBeenCalledTimes(2);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(task).toHaveBeenCalledTimes(4);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(task).toHaveBeenCalledTimes(5);
  });
});
