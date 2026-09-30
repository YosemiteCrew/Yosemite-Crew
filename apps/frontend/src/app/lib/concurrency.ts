/**
 * Maps `items` through `mapper` with at most `limit` calls in flight, keeping
 * results in input order. A limit of 1 runs the calls one after another in
 * order. The first rejection rejects the whole call and no further items start.
 */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let failed = false;

  const worker = async (): Promise<void> => {
    if (failed || nextIndex >= items.length) return;
    const currentIndex = nextIndex;
    nextIndex += 1;
    try {
      results[currentIndex] = await mapper(items[currentIndex]);
    } catch (error) {
      failed = true;
      throw error;
    }
    return worker();
  };

  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
};
