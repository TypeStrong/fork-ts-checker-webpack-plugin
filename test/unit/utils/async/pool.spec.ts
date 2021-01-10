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
    const shortTask = jest.fn(async (done: () => void) => {
      setTimeout(done, 10);
    });
    const longTask = jest.fn(async (done: () => void) => {
      setTimeout(done, 10000);
    });

    pool.submit(shortTask);
    pool.submit(shortTask);
    pool.submit(longTask);
    pool.submit(longTask);
    pool.submit(longTask);

    expect(shortTask).toHaveBeenCalledTimes(2);
    expect(longTask).toHaveBeenCalledTimes(0);

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(shortTask).toHaveBeenCalledTimes(2);
    expect(longTask).toHaveBeenCalledTimes(2);
  });
});
