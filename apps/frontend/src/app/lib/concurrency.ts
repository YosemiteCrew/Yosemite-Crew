/**
 * Maps `items` through `mapper` with at most `limit` calls in flight, keeping
 * results in input order. A limit of 1 runs the calls one after another in
 * order. After the first rejection no further items start; the call rejects
 * with that first error once the calls already in flight have settled.
 */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let failure = null as { error: unknown } | null;

  const worker = async (): Promise<void> => {
    if (failure || nextIndex >= items.length) return;
    const currentIndex = nextIndex;
    nextIndex += 1;
    try {
      results[currentIndex] = await mapper(items[currentIndex]);
    } catch (error) {
      failure ??= { error };
      return;
    }
    return worker();
  };

  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (failure) throw failure.error;
  return results;
};
