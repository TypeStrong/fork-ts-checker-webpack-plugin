import { createPool } from 'src/utils/async/pool';

function wait(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

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
    const shortTask = jest.fn(() => wait(10));
    const longTask = jest.fn(() => wait(500));

    pool.submit(shortTask);
    pool.submit(shortTask);
    pool.submit(longTask);
    pool.submit(longTask);
    pool.submit(longTask);

    expect(shortTask).toHaveBeenCalledTimes(2);
    expect(longTask).toHaveBeenCalledTimes(0);

    await wait(200);

    expect(shortTask).toHaveBeenCalledTimes(2);
    expect(longTask).toHaveBeenCalledTimes(2);

    await pool.drained;
  });

  it('works after draining', async () => {
    const pool = createPool(2);
    const shortTask = jest.fn(() => wait(10));

    pool.submit(shortTask);
    pool.submit(shortTask);
    pool.submit(shortTask);
    pool.submit(shortTask);

    expect(shortTask).toHaveBeenCalledTimes(2);

    await wait(100);

    expect(shortTask).toHaveBeenCalledTimes(4);

    pool.submit(shortTask);
    pool.submit(shortTask);

    expect(shortTask).toHaveBeenCalledTimes(6);

    await pool.drained;
  });
});
