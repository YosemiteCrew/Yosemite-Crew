import {
  addCachedPromise,
  type CachedPromise,
} from "../../src/utils/cached-promise-cache";

describe("cached-promise-cache", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("caps cache size by evicting the oldest entries", async () => {
    const cache = new Map<string, CachedPromise<number>>();
    jest.spyOn(Date, "now").mockReturnValue(1_000);

    const options = { maxEntries: 3, pruneIntervalMs: 0 };

    const promises: Array<Promise<number>> = [];
    for (let i = 0; i < 10; i += 1) {
      promises.push(
        addCachedPromise(cache, `k${i}`, 10_000, async () => i, options),
      );
    }
    await Promise.all(promises);

    expect(cache.size).toBe(3);
    expect(Array.from(cache.keys())).toEqual(["k7", "k8", "k9"]);
  });

  it("keeps recently used entries (LRU bump) when enforcing the cap", async () => {
    const cache = new Map<string, CachedPromise<string>>();
    jest.spyOn(Date, "now").mockReturnValue(1_000);

    const options = { maxEntries: 2, pruneIntervalMs: 0 };

    await addCachedPromise(cache, "a", 10_000, async () => "A", options);
    await addCachedPromise(cache, "b", 10_000, async () => "B", options);

    const factory = jest.fn(async () => "A2");
    await addCachedPromise(cache, "a", 10_000, factory, options);
    expect(factory).not.toHaveBeenCalled();

    await addCachedPromise(cache, "c", 10_000, async () => "C", options);

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("purges expired entries during pruning", async () => {
    const cache = new Map<string, CachedPromise<number>>();
    cache.set("expired", { expiresAt: 500, promise: Promise.resolve(1) });
    cache.set("valid", { expiresAt: 1_500, promise: Promise.resolve(2) });

    jest.spyOn(Date, "now").mockReturnValue(1_000);

    await addCachedPromise(cache, "new", 10_000, async () => 3, {
      maxEntries: 10,
      pruneIntervalMs: 0,
    });

    expect(cache.has("expired")).toBe(false);
    expect(cache.has("valid")).toBe(true);
    expect(cache.has("new")).toBe(true);
  });

  it("removes the entry if the factory rejects", async () => {
    const cache = new Map<string, CachedPromise<number>>();
    jest.spyOn(Date, "now").mockReturnValue(1_000);

    await expect(
      addCachedPromise(
        cache,
        "err",
        10_000,
        async () => {
          throw new Error("boom");
        },
        { maxEntries: 10, pruneIntervalMs: 0 },
      ),
    ).rejects.toThrow("boom");

    expect(cache.has("err")).toBe(false);
  });
});
