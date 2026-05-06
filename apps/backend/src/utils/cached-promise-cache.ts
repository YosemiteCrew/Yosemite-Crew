export type CachedPromise<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

type AddCachedPromiseOptions = {
  maxEntries: number;
  pruneIntervalMs: number;
};

const lastPruneAtByCache = new WeakMap<Map<string, unknown>, number>();

const pruneCache = <T>(
  cache: Map<string, CachedPromise<T>>,
  now: number,
  options: AddCachedPromiseOptions,
) => {
  const lastPruneAt = lastPruneAtByCache.get(cache) ?? 0;
  const shouldPrune =
    cache.size > options.maxEntries ||
    now - lastPruneAt >= options.pruneIntervalMs;

  if (!shouldPrune) return;

  lastPruneAtByCache.set(cache, now);

  for (const [key, value] of cache) {
    if (value.expiresAt <= now) {
      cache.delete(key);
    }
  }

  while (cache.size > options.maxEntries) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
};

export const addCachedPromise = <T>(
  cache: Map<string, CachedPromise<T>>,
  key: string,
  ttlMs: number,
  factory: () => Promise<T>,
  options: AddCachedPromiseOptions,
) => {
  const now = Date.now();

  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) {
    cache.delete(key);
    cache.set(key, existing);
    pruneCache(cache, now, options);
    return existing.promise;
  }

  if (existing) {
    cache.delete(key);
  }

  pruneCache(cache, now, options);

  const promise = factory().catch((error) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, {
    expiresAt: now + ttlMs,
    promise,
  });

  pruneCache(cache, now, options);

  return promise;
};
