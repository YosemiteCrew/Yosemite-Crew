import { mapWithConcurrency } from '@/app/lib/concurrency';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

const defer = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('mapWithConcurrency', () => {
  it('returns an empty list without calling the mapper', async () => {
    const mapper = jest.fn();
    await expect(mapWithConcurrency([], 3, mapper)).resolves.toEqual([]);
    expect(mapper).not.toHaveBeenCalled();
  });

  it('keeps results in input order even when later items finish first', async () => {
    const pending = [defer<string>(), defer<string>(), defer<string>()];
    const run = mapWithConcurrency([0, 1, 2], 3, (index) => pending[index].promise);

    pending[2].resolve('c');
    pending[0].resolve('a');
    pending[1].resolve('b');

    await expect(run).resolves.toEqual(['a', 'b', 'c']);
  });

  it('never has more than the limit in flight', async () => {
    const pending = Array.from({ length: 5 }, () => defer<number>());
    const started: number[] = [];
    const run = mapWithConcurrency([0, 1, 2, 3, 4], 2, (index) => {
      started.push(index);
      return pending[index].promise;
    });

    await flush();
    expect(started).toEqual([0, 1]);

    pending[1].resolve(1);
    await flush();
    expect(started).toEqual([0, 1, 2]);

    pending[0].resolve(0);
    pending[2].resolve(2);
    await flush();
    expect(started).toEqual([0, 1, 2, 3, 4]);

    pending[3].resolve(3);
    pending[4].resolve(4);
    await expect(run).resolves.toEqual([0, 1, 2, 3, 4]);
  });

  it('runs one at a time, in order, with a limit of 1', async () => {
    const pending = [defer<void>(), defer<void>(), defer<void>()];
    const started: number[] = [];
    const run = mapWithConcurrency([0, 1, 2], 1, (index) => {
      started.push(index);
      return pending[index].promise;
    });

    await flush();
    expect(started).toEqual([0]);
    pending[0].resolve();
    await flush();
    expect(started).toEqual([0, 1]);
    pending[1].resolve();
    await flush();
    expect(started).toEqual([0, 1, 2]);
    pending[2].resolve();
    await run;
  });

  it('treats a limit below 1 as 1', async () => {
    const started: number[] = [];
    const pending = [defer<void>(), defer<void>()];
    const run = mapWithConcurrency([0, 1], 0, (index) => {
      started.push(index);
      return pending[index].promise;
    });

    await flush();
    expect(started).toEqual([0]);
    pending[0].resolve();
    pending[1].resolve();
    await run;
    expect(started).toEqual([0, 1]);
  });

  it('rejects with the first failure and starts no further items', async () => {
    const pending = Array.from({ length: 4 }, () => defer<number>());
    const started: number[] = [];
    const run = mapWithConcurrency([0, 1, 2, 3], 2, (index) => {
      started.push(index);
      return pending[index].promise;
    });
    const outcome = run.catch((error: unknown) => error);

    await flush();
    pending[0].reject(new Error('offline'));
    await expect(outcome).resolves.toEqual(new Error('offline'));

    pending[1].resolve(1);
    await flush();
    expect(started).toEqual([0, 1]);
  });
});
