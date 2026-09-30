import { describe, expect, it, jest } from "@jest/globals";
import {
  mapInSequence,
  mapWithConcurrency,
} from "../../src/utils/async-iteration";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("mapInSequence", () => {
  it("returns results in input order and passes the index", async () => {
    const results = await mapInSequence(["a", "b", "c"], (item, index) =>
      Promise.resolve(`${item}${index}`),
    );
    expect(results).toEqual(["a0", "b1", "c2"]);
  });

  it("resolves to an empty array without calling the task", async () => {
    const task = jest.fn(() => Promise.resolve(1));
    await expect(mapInSequence([], task)).resolves.toEqual([]);
    expect(task).not.toHaveBeenCalled();
  });

  it("starts each task only after the previous one settles", async () => {
    const gates = [deferred<void>(), deferred<void>()];
    const started: number[] = [];
    const run = mapInSequence([0, 1], (item) => {
      started.push(item);
      return gates[item].promise;
    });

    await flush();
    expect(started).toEqual([0]);
    gates[0].resolve();
    await flush();
    expect(started).toEqual([0, 1]);
    gates[1].resolve();
    await run;
  });

  it("rejects with the first failure and starts nothing after it", async () => {
    const started: number[] = [];
    const failure = new Error("boom");
    await expect(
      mapInSequence([0, 1, 2], (item) => {
        started.push(item);
        return item === 1 ? Promise.reject(failure) : Promise.resolve(item);
      }),
    ).rejects.toBe(failure);
    expect(started).toEqual([0, 1]);
  });
});

describe("mapWithConcurrency", () => {
  it("returns results in input order even when tasks finish out of order", async () => {
    const gates = [deferred<string>(), deferred<string>(), deferred<string>()];
    const run = mapWithConcurrency([0, 1, 2], (item) => gates[item].promise, 3);
    gates[2].resolve("c");
    gates[0].resolve("a");
    gates[1].resolve("b");
    await expect(run).resolves.toEqual(["a", "b", "c"]);
  });

  it("never has more than the limit in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithConcurrency(
      Array.from({ length: 12 }, (_, index) => index),
      async (item) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await flush();
        inFlight -= 1;
        return item * 2;
      },
      3,
    );
    expect(peak).toBe(3);
    expect(results).toEqual(Array.from({ length: 12 }, (_, i) => i * 2));
  });

  it("defaults to five at a time", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 9 }, (_, i) => i),
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await flush();
        inFlight -= 1;
      },
    );
    expect(peak).toBe(5);
  });

  it("treats a limit below one as one at a time", async () => {
    const started: number[] = [];
    const gates = [deferred<void>(), deferred<void>()];
    const run = mapWithConcurrency(
      [0, 1],
      (item) => {
        started.push(item);
        return gates[item].promise;
      },
      0,
    );
    await flush();
    expect(started).toEqual([0]);
    gates[0].resolve();
    await flush();
    expect(started).toEqual([0, 1]);
    gates[1].resolve();
    await run;
  });

  it("resolves to an empty array without calling the task", async () => {
    const task = jest.fn(() => Promise.resolve(1));
    await expect(mapWithConcurrency([], task, 5)).resolves.toEqual([]);
    expect(task).not.toHaveBeenCalled();
  });

  it("rejects with the first failure and starts no new item after it", async () => {
    const started: number[] = [];
    const failure = new Error("boom");
    await expect(
      mapWithConcurrency(
        [0, 1, 2, 3, 4],
        async (item) => {
          started.push(item);
          await flush();
          if (item === 0) throw failure;
          return item;
        },
        2,
      ),
    ).rejects.toBe(failure);
    await flush();
    await flush();
    expect(started).toEqual([0, 1]);
  });
  it("lets tasks already running settle before rejecting", async () => {
    const failure = new Error("boom");
    const gate = deferred<number>();
    let siblingSettled = false;
    const run = mapWithConcurrency(
      [0, 1],
      (item) => {
        if (item === 0) return Promise.reject(failure);
        return gate.promise.then((value) => {
          siblingSettled = true;
          return value;
        });
      },
      2,
    );
    let rejected = false;
    run.catch(() => {
      rejected = true;
    });
    await flush();
    expect(rejected).toBe(false);
    gate.resolve(1);
    await expect(run).rejects.toBe(failure);
    expect(siblingSettled).toBe(true);
  });

  it("rejects with the first failure when several tasks fail", async () => {
    const first = new Error("first");
    await expect(
      mapWithConcurrency(
        [0, 1],
        async (item) => {
          await flush();
          if (item === 1) await flush();
          throw item === 0 ? first : new Error("second");
        },
        2,
      ),
    ).rejects.toBe(first);
  });

  it("falls back to the default when the limit is not a finite number", async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithConcurrency(
      Array.from({ length: 9 }, (_, i) => i),
      async (item) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await flush();
        inFlight -= 1;
        return item;
      },
      Number.NaN,
    );
    expect(peak).toBe(5);
    expect(results).toEqual(Array.from({ length: 9 }, (_, i) => i));
  });
});
