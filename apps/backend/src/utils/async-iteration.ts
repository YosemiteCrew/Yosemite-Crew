/**
 * Iterate over items with an async task, either strictly one after another or
 * a few at a time.
 *
 * Both helpers keep the shape of a plain loop: results come back in input
 * order, and the first failure rejects the returned promise and stops any
 * further item from being started.
 */

/** A small cap that keeps parallel reads well inside the database pool. */
export const DEFAULT_CONCURRENCY = 5;

/**
 * Run `task` for every item in order, starting each one only after the
 * previous one has settled. Use it for work that depends on order or shares a
 * transaction.
 */
export const mapInSequence = <T, R>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  const step = async (index: number): Promise<R[]> => {
    if (index >= items.length) return results;
    results.push(await task(items[index], index));
    return step(index + 1);
  };
  return step(0);
};

/**
 * Run `task` for every item with at most `limit` tasks in flight at once. Use
 * it for independent work, such as reads that do not affect each other.
 *
 * After the first failure no new item starts; tasks already running are
 * allowed to settle, then the error of the earliest failing item in input
 * order is rethrown. Every item before it has already been started, so this is
 * the error a plain loop would have stopped at, and nothing is still running
 * once the returned promise rejects.
 */
export const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<R>,
  limit: number = DEFAULT_CONCURRENCY,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  // Index of the earliest failing item; items.length while nothing failed.
  let failedIndex = items.length;
  let failedError: unknown;

  const worker = async (): Promise<void> => {
    if (failedIndex < items.length || nextIndex >= items.length) return;
    const index = nextIndex;
    nextIndex += 1;
    try {
      results[index] = await task(items[index], index);
    } catch (error) {
      if (index < failedIndex) {
        failedIndex = index;
        failedError = error;
      }
      return;
    }
    return worker();
  };

  const cap = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : DEFAULT_CONCURRENCY;
  const workerCount = Math.min(cap, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (failedIndex < items.length) throw failedError;
  return results;
};
